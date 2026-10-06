"""Persistence adapter for the advisory payment-delay model."""
from __future__ import annotations

from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.services import intelligence_service, portfolio
from intelligence.priors import PriorResolver
from intelligence.stats import bayesian_shrinkage
from intelligence.dl import (
    assert_no_feature_leakage,
    build_payment_delay_examples,
    dataset_quality,
    predict_payment_delay,
    temporal_split,
    train_payment_delay_model,
)


def owner_projects(db: Session, owner_id: str) -> list[models.Project]:
    return db.scalars(
        select(models.Project).where(models.Project.owner_id == owner_id).order_by(models.Project.start_date)
    ).all()


def dataset_summary(db: Session, owner_id: str) -> dict:
    examples = build_payment_delay_examples(owner_projects(db, owner_id))
    assert_no_feature_leakage(examples)
    train, validation = temporal_split(examples) if examples else ([], [])
    return {
        "datasetVersion": "payment-delay-v1",
        "sampleCount": len(examples),
        "trainingCount": len(train),
        "validationCount": len(validation),
        "cutoff": max((example.cutoff for example in examples), default=None),
        "currencyContexts": sorted({example.currency for example in examples}),
        "leakageChecked": True,
        "quality": dataset_quality(examples),
    }


def train(db: Session, owner_id: str, epochs: int, seed: int) -> dict:
    examples = build_payment_delay_examples(owner_projects(db, owner_id))
    assert_no_feature_leakage(examples)
    training, validation = temporal_split(examples)
    quality = dataset_quality(examples)
    if not quality["productionReady"]:
        raise ValueError("Training data is not production-ready: " + "; ".join(quality["reasons"]))
    artifact_dir = Path(get_settings().dl_artifact_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    run = models.ModelRun(
        owner_id=owner_id,
        model_version="payment-delay-gru-v1",
        architecture="GRU(input=2,hidden=16)",
        dataset_version="payment-delay-v1",
        training_sample_count=len(training),
        training_cutoff=max(example.cutoff for example in training),
        validation_cutoff=min((example.cutoff for example in validation), default=None),
        validation_metrics={},
        config={"epochs": epochs, "seed": seed},
    )
    db.add(run)
    db.flush()
    artifact = artifact_dir / f"{run.id}.pt"
    metrics = train_payment_delay_model(training, validation, str(artifact), epochs=epochs, seed=seed)
    run.validation_metrics = {
        "maeDays": metrics["validationMae"],
        "rmseDays": metrics["validationRmse"],
        "r2": metrics["validationR2"],
        "baselineMaeDays": metrics["baselineMae"],
        "beatsBaseline": metrics["beatsBaseline"],
        "bestEpoch": metrics["bestEpoch"],
    }
    run.artifact_reference = str(artifact)
    db.commit()
    return {
        "modelRunId": run.id,
        "modelVersion": run.model_version,
        "architecture": run.architecture,
        "datasetVersion": run.dataset_version,
        "trainingSampleCount": run.training_sample_count,
        "validationMetrics": run.validation_metrics,
        "artifactReference": run.artifact_reference,
    }


def status(db: Session, owner_id: str) -> dict:
    run = db.scalars(
        select(models.ModelRun)
        .where(models.ModelRun.owner_id == owner_id)
        .order_by(models.ModelRun.created_at.desc())
    ).first()
    return {"available": run is not None, "latestRun": None if run is None else {
        "id": run.id, "modelVersion": run.model_version, "architecture": run.architecture,
        "datasetVersion": run.dataset_version, "trainingSampleCount": run.training_sample_count,
        "validationMetrics": run.validation_metrics,
    }, "dataset": dataset_summary(db, owner_id)}


def predict(db: Session, owner_id: str, project: models.Project) -> dict:
    run = db.scalars(
        select(models.ModelRun)
        .where(models.ModelRun.owner_id == owner_id)
        .order_by(models.ModelRun.created_at.desc())
    ).first()
    if not run or not run.artifact_reference:
        raise LookupError("No trained advisory model is available")
    examples = [example for example in build_payment_delay_examples([project]) if example.project_id == project.id]
    if not examples:
        raise LookupError("Project has no verified payment history suitable for prediction")
    example = examples[0]
    value = predict_payment_delay(run.artifact_reference, example)
    prediction = models.ModelPrediction(
        model_run_id=run.id, owner_id=owner_id, project_id=project.id,
        predicted_delay_days=value, confidence=0.5, prediction_cutoff=example.cutoff,
        currency=project.currency, provenance=example.provenance, status="advisory",
    )
    db.add(prediction)
    db.commit()
    return {
        "id": prediction.id, "projectId": project.id, "predictedDelayDays": value,
        "confidence": prediction.confidence, "modelVersion": run.model_version,
        "trainingSampleCount": run.training_sample_count, "predictionCutoff": example.cutoff.isoformat(),
        "currency": project.currency, "status": prediction.status, "provenance": prediction.provenance,
    }


def _latest_trusted_run(db: Session, owner_id: str) -> models.ModelRun | None:
    run = db.scalars(
        select(models.ModelRun).where(models.ModelRun.owner_id == owner_id).order_by(models.ModelRun.created_at.desc())
    ).first()
    # Only a model that beat "always predict the average delay" on later data is allowed to move a forecast.
    if run and run.artifact_reference and (run.validation_metrics or {}).get("beatsBaseline") is True:
        return run
    return None


def estimate_payment_delay(db: Session, user: models.User) -> dict:
    """How many days past the agreed date this creator's clients are expected to pay the final balance.

    Order of evidence (the `source` says which one was used, so the UI never overstates it):
      gru      a trained payment-delay GRU that beat the baseline, averaged over open projects with payment history
      history  the creator's own completed projects, shrunk toward the craft/industry prior
      prior    no history yet: the craft/industry/platform prior
    `learned` is True only for the GRU.
    """
    run = _latest_trusted_run(db, user.id)
    if run is not None:
        predictions: list[float] = []
        for project in portfolio.user_projects(db, user.id):
            if project.stage not in portfolio.OPEN_STAGES:
                continue
            example = next((e for e in build_payment_delay_examples([project]) if e.project_id == project.id), None)
            if example is None:
                continue
            try:
                predictions.append(predict_payment_delay(run.artifact_reference, example))
            except (RuntimeError, OSError, KeyError):  # torch missing or artifact unreadable: use the statistical estimate
                predictions = []
                break
        if predictions:
            return {"days": round(sum(predictions) / len(predictions), 1), "source": "gru", "learned": True,
                    "modelVersion": run.model_version, "projects": len(predictions)}
    _, delays, _ = intelligence_service._history(db, user.id)
    craft = (user.profile.craft if user.profile else "") or ""
    prior = PriorResolver.get_creator_baseline_delay(delays, craft)
    days = bayesian_shrinkage(delays, prior)
    return {"days": round(days, 1), "source": "history" if delays else "prior", "learned": False, "observations": len(delays)}

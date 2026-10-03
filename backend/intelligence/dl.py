"""Database-derived payment-delay dataset and optional PyTorch model.

Feature construction is deliberately independent of SQLAlchemy. Callers pass
normalized project/payment records, making the cutoff and leakage checks
testable before any model is trained.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

MIN_PRODUCTION_SAMPLES = 30
MIN_PRODUCTION_VALIDATION_SAMPLES = 6


@dataclass(frozen=True)
class PaymentDelayExample:
    project_id: str
    cutoff: date
    sequence: tuple[tuple[float, ...], ...]
    target_delay_days: float
    currency: str
    provenance: dict[str, Any]
    feature_dates: tuple[date, ...] = ()


def build_payment_delay_examples(projects: list[Any]) -> list[PaymentDelayExample]:
    examples: list[PaymentDelayExample] = []
    for project in projects:
        verified = sorted(
            (payment for payment in project.payments if payment.status == "verified" and payment.verified_at),
            key=lambda payment: payment.verified_at,
        )
        if not verified:
            continue
        final_payment = verified[-1]
        cutoff = project.start_date
        due = project.start_date.toordinal() + project.expected_payment_days
        cutoff = date.fromordinal(due)
        sequence = []
        for payment in verified:
            event_day = payment.verified_at.date()
            if event_day > cutoff:
                continue
            sequence.append(((event_day - project.start_date).days, payment.amount_kobo / max(project.revenue_kobo, 1)))
        if not sequence:
            sequence = [(0, 0.0)]
        if any(event_day > cutoff for event_day in (payment.verified_at.date() for payment in verified if payment.verified_at)):
            # Future payments are allowed as labels, never as features.
            pass
        target = max(0, (final_payment.verified_at.date() - cutoff).days)
        examples.append(
            PaymentDelayExample(
                project_id=project.id,
                cutoff=cutoff,
                sequence=tuple((float(day), float(amount)) for day, amount in sequence),
                target_delay_days=float(target),
                currency=project.currency,
                provenance={"source": "projects.payments", "cutoff": cutoff.isoformat()},
                feature_dates=tuple(
                    payment.verified_at.date()
                    for payment in verified
                    if payment.verified_at.date() <= cutoff
                ),
            )
        )
    return sorted(examples, key=lambda example: example.cutoff)


def temporal_split(
    examples: list[PaymentDelayExample], validation_fraction: float = 0.2
) -> tuple[list[PaymentDelayExample], list[PaymentDelayExample]]:
    if not 0 < validation_fraction < 1:
        raise ValueError("validation_fraction must be between 0 and 1")
    ordered = sorted(examples, key=lambda example: example.cutoff)
    split = max(1, min(len(ordered), int(len(ordered) * (1 - validation_fraction))))
    train, validation = ordered[:split], ordered[split:]
    if train and validation and max(example.cutoff for example in train) > min(example.cutoff for example in validation):
        raise AssertionError("temporal split leaked future examples into training")
    return train, validation


def dataset_quality(examples: list[PaymentDelayExample]) -> dict[str, Any]:
    """Describe whether the data is large enough for a defensible model metric.

    Small demo datasets are intentionally reported as insufficient rather than
    presenting an overfit validation score as production evidence.
    """
    train, validation = temporal_split(examples) if examples else ([], [])
    reasons: list[str] = []
    if len(examples) < MIN_PRODUCTION_SAMPLES:
        reasons.append(f"at least {MIN_PRODUCTION_SAMPLES} independent project examples are required")
    if len(validation) < MIN_PRODUCTION_VALIDATION_SAMPLES:
        reasons.append(f"at least {MIN_PRODUCTION_VALIDATION_SAMPLES} temporal validation examples are required")
    if len({example.currency for example in examples}) > 1:
        reasons.append("currency contexts must be modeled separately or normalized with exchange-rate evidence")
    return {
        "productionReady": not reasons,
        "reasons": reasons,
        "minimumSampleCount": MIN_PRODUCTION_SAMPLES,
        "minimumValidationCount": MIN_PRODUCTION_VALIDATION_SAMPLES,
    }


def assert_no_feature_leakage(examples: list[PaymentDelayExample]) -> None:
    for example in examples:
        if any(event_date > example.cutoff for event_date in example.feature_dates):
            raise AssertionError("feature event occurs after prediction cutoff")


def _model_class() -> Any:
    """Train the advisory GRU when PyTorch is installed in the selected environment."""
    try:
        import torch  # type: ignore
        import torch.nn as nn  # type: ignore
    except ImportError as exc:
        raise RuntimeError("PyTorch is required for DL training; install the backend DL extras") from exc

    class PaymentDelayGRU(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.gru = nn.GRU(input_size=2, hidden_size=16, batch_first=True)
            self.head = nn.Linear(16, 1)

        def forward(self, values: Any) -> Any:
            _, hidden = self.gru(values)
            return self.head(hidden[-1]).squeeze(-1)

    return PaymentDelayGRU


def _tensors(examples: list[PaymentDelayExample]) -> tuple[Any, Any]:
    import torch

    width = max((len(example.sequence) for example in examples), default=1)
    values = torch.zeros((len(examples), width, 2), dtype=torch.float32)
    targets = torch.zeros((len(examples),), dtype=torch.float32)
    for index, example in enumerate(examples):
        values[index, : len(example.sequence)] = torch.tensor(example.sequence, dtype=torch.float32)
        targets[index] = example.target_delay_days
    return values, targets


def train_payment_delay_model(
    train_examples: list[PaymentDelayExample],
    validation_examples: list[PaymentDelayExample],
    artifact_path: str,
    epochs: int = 25,
    seed: int = 42,
) -> dict[str, Any]:
    try:
        import torch
    except ImportError as exc:
        raise RuntimeError("PyTorch is required for DL training; install the backend DL extras") from exc
    if not train_examples:
        raise ValueError("At least one training example is required")
    if not validation_examples:
        raise ValueError("A non-empty temporal validation set is required")
    torch.manual_seed(seed)
    model = _model_class()()
    values, targets = _tensors(train_examples)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = torch.nn.MSELoss()
    model.train()
    for _ in range(epochs):
        optimizer.zero_grad()
        loss = loss_fn(model(values), targets)
        loss.backward()
        optimizer.step()
    model.eval()
    with torch.no_grad():
        validation_values, validation_targets = _tensors(validation_examples)
        predictions = model(validation_values)
        errors = predictions - validation_targets
        mae = torch.mean(torch.abs(errors)).item()
        rmse = torch.sqrt(torch.mean(errors.square())).item()
        baseline = torch.full_like(validation_targets, torch.mean(targets))
        baseline_mae = torch.mean(torch.abs(baseline - validation_targets)).item()
        r2_denominator = torch.sum((validation_targets - torch.mean(validation_targets)) ** 2).item()
        r2 = None if r2_denominator == 0 else 1 - torch.sum(errors.square()).item() / r2_denominator
    torch.save({"state_dict": model.state_dict(), "architecture": "gru", "input_size": 2, "hidden_size": 16}, artifact_path)
    return {
        "artifactReference": artifact_path,
        "epochs": epochs,
        "validationMae": mae,
        "validationRmse": rmse,
        "validationR2": r2,
        "baselineMae": baseline_mae,
        "seed": seed,
    }


def predict_payment_delay(artifact_path: str, example: PaymentDelayExample) -> float:
    try:
        import torch
    except ImportError as exc:
        raise RuntimeError("PyTorch is required for DL inference; install the backend DL extras") from exc
    payload = torch.load(artifact_path, map_location="cpu", weights_only=True)
    model = _model_class()()
    model.load_state_dict(payload["state_dict"])
    model.eval()
    values, _ = _tensors([example])
    with torch.no_grad():
        return max(0.0, float(model(values)[0].item()))

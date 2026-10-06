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


FEATURE_SCALE = (60.0, 1.0)  # (days since project start, share of the price paid): keeps both inputs near 0..1
HIDDEN_SIZE = 16


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
            self.gru = nn.GRU(input_size=2, hidden_size=HIDDEN_SIZE, batch_first=True)
            self.head = nn.Linear(HIDDEN_SIZE, 1)

        def forward(self, values: Any, lengths: Any) -> Any:
            # Pack so the zero padding after a short sequence never reaches the hidden state
            # (reading hidden[-1] of a padded batch mixes padding into every short example).
            packed = nn.utils.rnn.pack_padded_sequence(values, lengths.cpu(), batch_first=True, enforce_sorted=False)
            _, hidden = self.gru(packed)
            return self.head(hidden[-1]).squeeze(-1)

    return PaymentDelayGRU


def _tensors(examples: list[PaymentDelayExample]) -> tuple[Any, Any, Any]:
    import torch

    width = max((len(example.sequence) for example in examples), default=1)
    values = torch.zeros((len(examples), width, 2), dtype=torch.float32)
    targets = torch.zeros((len(examples),), dtype=torch.float32)
    lengths = torch.ones((len(examples),), dtype=torch.long)
    scale = torch.tensor(FEATURE_SCALE, dtype=torch.float32)
    for index, example in enumerate(examples):
        seq = torch.tensor(example.sequence, dtype=torch.float32) / scale
        values[index, : len(example.sequence)] = seq
        lengths[index] = max(1, len(example.sequence))
        targets[index] = example.target_delay_days
    return values, targets, lengths


def _metrics(model: Any, examples: list[PaymentDelayExample], train_mean: float) -> dict[str, Any]:
    import torch

    values, targets, lengths = _tensors(examples)
    with torch.no_grad():
        predictions = model(values, lengths)
        errors = predictions - targets
        mae = torch.mean(torch.abs(errors)).item()
        rmse = torch.sqrt(torch.mean(errors.square())).item()
        baseline_mae = torch.mean(torch.abs(torch.full_like(targets, train_mean) - targets)).item()
        r2_denominator = torch.sum((targets - torch.mean(targets)) ** 2).item()
        r2 = None if r2_denominator == 0 else 1 - torch.sum(errors.square()).item() / r2_denominator
    return {"mae": mae, "rmse": rmse, "baselineMae": baseline_mae, "r2": r2}


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
    values, targets, lengths = _tensors(train_examples)
    train_mean = float(torch.mean(targets).item())
    with torch.no_grad():
        model.head.bias.fill_(train_mean)  # start from "predict the average delay" so a few epochs refine it
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = torch.nn.HuberLoss(delta=7.0)  # late payments are heavy-tailed; one 90-day outlier should not dominate
    best_state, best_mae, best_epoch = None, float("inf"), 0
    for epoch in range(1, epochs + 1):
        model.train()
        optimizer.zero_grad()
        loss = loss_fn(model(values, lengths), targets)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        optimizer.step()
        model.eval()
        val_mae = _metrics(model, validation_examples, train_mean)["mae"]
        if val_mae < best_mae:  # keep the best epoch on the later (temporal) validation slice, not the last one
            best_state, best_mae, best_epoch = {k: v.detach().clone() for k, v in model.state_dict().items()}, val_mae, epoch
    model.load_state_dict(best_state)
    model.eval()
    m = _metrics(model, validation_examples, train_mean)
    torch.save({"state_dict": model.state_dict(), "architecture": "gru", "input_size": 2, "hidden_size": HIDDEN_SIZE,
                "feature_scale": FEATURE_SCALE, "train_mean_delay": train_mean}, artifact_path)
    return {
        "artifactReference": artifact_path,
        "epochs": epochs,
        "bestEpoch": best_epoch,
        "validationMae": m["mae"],
        "validationRmse": m["rmse"],
        "validationR2": m["r2"],
        "baselineMae": m["baselineMae"],
        # The model is only trusted for forecasts if it beats "always predict the average delay".
        "beatsBaseline": m["mae"] < m["baselineMae"],
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
    values, _, lengths = _tensors([example])
    with torch.no_grad():
        return max(0.0, float(model(values, lengths)[0].item()))

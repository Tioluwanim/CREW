from datetime import date, timedelta

from intelligence.dl import (
    MIN_PRODUCTION_SAMPLES,
    PaymentDelayExample,
    dataset_quality,
    temporal_split,
)


def _example(index: int) -> PaymentDelayExample:
    cutoff = date(2024, 1, 1) + timedelta(days=index)
    return PaymentDelayExample(
        project_id=f"project-{index}",
        cutoff=cutoff,
        sequence=((0.0, 0.5),),
        target_delay_days=float(index % 7),
        currency="NGN",
        provenance={"source": "test"},
        feature_dates=(cutoff,),
    )


def test_small_demo_dataset_is_not_production_ready():
    quality = dataset_quality([_example(index) for index in range(2)])

    assert quality["productionReady"] is False
    assert quality["minimumSampleCount"] == MIN_PRODUCTION_SAMPLES
    assert quality["reasons"]


def test_sufficient_temporal_dataset_is_production_ready():
    examples = [_example(index) for index in range(38)]
    training, validation = temporal_split(examples)
    quality = dataset_quality(examples)

    assert len(training) >= 30
    assert len(validation) >= 6
    assert quality["productionReady"] is True


def _torch_examples(n: int):
    # Late payers are the ones whose deposit came in late: a learnable signal, not noise.
    out = []
    for i in range(n):
        first_payment_day = float(2 + (i * 7) % 20)
        out.append(PaymentDelayExample(
            project_id=f"p{i}", cutoff=date(2024, 1, 1) + timedelta(days=i),
            sequence=((first_payment_day, 0.4),) if i % 3 else ((first_payment_day, 0.2), (first_payment_day + 5, 0.2)),
            target_delay_days=first_payment_day * 0.8, currency="NGN", provenance={"source": "test"},
            feature_dates=(date(2024, 1, 1) + timedelta(days=i),)))
    return out


def test_gru_trains_masks_padding_and_reports_baseline(tmp_path):
    torch = __import__("pytest").importorskip("torch")
    from intelligence.dl import _model_class, _tensors, predict_payment_delay, train_payment_delay_model

    examples = _torch_examples(48)
    training, validation = temporal_split(examples)
    out = train_payment_delay_model(training, validation, str(tmp_path / "m.pt"), epochs=150, seed=1)
    assert out["beatsBaseline"] is True and out["validationMae"] < out["baselineMae"]
    assert 1 <= out["bestEpoch"] <= 150
    assert predict_payment_delay(out["artifactReference"], validation[0]) >= 0

    # Padding must not change a short sequence's prediction: batched with a longer one == alone.
    model = _model_class()()
    model.eval()
    short, long_ = examples[1], examples[0]
    alone = model(*[t for i, t in enumerate(_tensors([short])) if i != 1])
    values, _, lengths = _tensors([short, long_])
    batched = model(values, lengths)[0:1]
    assert torch.allclose(alone, batched, atol=1e-6)

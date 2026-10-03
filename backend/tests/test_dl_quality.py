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

from decimal import Decimal

import pytest

from app.payments.domain import as_utc, from_provider_amount, to_provider_amount
from app.payments.errors import ProviderAuthError, ProviderRejected, ProviderUnavailable
from app.payments.http import HttpClient, HttpResponse, HttpTransportError, ProviderHttp, redact


# ---------------------------------------------------------------- money units
def test_naira_wire_amounts_are_exact_decimals_not_floats():
    assert to_provider_amount(150_050, "naira") == Decimal("1500.50")
    assert to_provider_amount(150_050, "kobo") == 150_050
    assert from_provider_amount("1500.50", "naira") == 150_050
    assert from_provider_amount(1500.5, "naira") == 150_050
    assert from_provider_amount(150_050, "kobo") == 150_050


@pytest.mark.parametrize("kobo", [0, 1, 99, 100, 101, 12_345_678_901])
def test_roundtrip_is_lossless_in_both_units(kobo):
    for unit in ("kobo", "naira"):
        assert from_provider_amount(to_provider_amount(kobo, unit), unit) == kobo


def test_the_classic_float_trap_does_not_bite():
    assert from_provider_amount(0.29, "naira") == 29 and from_provider_amount(1.1, "naira") == 110   # int(0.29*100) == 28 in float land


def test_naive_datetimes_become_utc():
    from datetime import datetime
    assert as_utc(datetime(2026, 1, 1)).tzinfo is not None


# ---------------------------------------------------------------- http resilience
class Script(HttpClient):
    def __init__(self, *responses): self.responses, self.calls = list(responses), []
    def request(self, method, url, **kw):
        self.calls.append((method, url))
        r = self.responses.pop(0)
        if isinstance(r, Exception): raise r
        return r


def http(script, **kw): return ProviderHttp("https://api.test", script, sleep=lambda s: None, **kw)


def test_get_is_retried_on_5xx_then_succeeds():
    s = Script(HttpResponse(503), HttpTransportError("Timeout"), HttpResponse(200, {"ok": 1}))
    assert http(s).call("GET", "/x") == {"ok": 1} and len(s.calls) == 3


def test_post_without_idempotency_is_never_retried():
    s = Script(HttpResponse(503), HttpResponse(200, {"paid": "twice"}))
    with pytest.raises(ProviderUnavailable):
        http(s).call("POST", "/payouts", json={})
    assert len(s.calls) == 1                      # a retried payout could pay twice - so it must not happen


def test_post_with_provider_idempotency_key_is_retried():
    s = Script(HttpTransportError("Timeout"), HttpResponse(201, {"id": "1"}))
    assert http(s).call("POST", "/charges", json={}, idempotent=True) == {"id": "1"} and len(s.calls) == 2


def test_error_mapping():
    with pytest.raises(ProviderAuthError):
        http(Script(HttpResponse(401))).call("GET", "/x")
    with pytest.raises(ProviderRejected) as e:
        http(Script(HttpResponse(422, {"message": "bad account"}))).call("POST", "/x")
    assert "bad account" in str(e.value) and e.value.code == "422"
    with pytest.raises(ProviderUnavailable):
        http(Script(*[HttpResponse(500)] * 3)).call("GET", "/x")           # gives up after max attempts
    assert not ProviderRejected("x").retryable and ProviderUnavailable("x").retryable


def test_429_is_treated_as_retryable():
    assert http(Script(HttpResponse(429), HttpResponse(200, {"ok": True}))).call("GET", "/x") == {"ok": True}


def test_secrets_are_redacted_before_logging_or_storing():
    r = redact({"Authorization": "Bearer abc", "nested": [{"client_secret": "s", "amount": 5}], "ok": 1})
    assert r == {"Authorization": "***", "nested": [{"client_secret": "***", "amount": 5}], "ok": 1}

"""The engine is a pure function, so every rule is tested without a database or a provider."""
from datetime import datetime, timedelta, timezone

from app.payments.domain import Direction, ProviderTransaction, TxnStatus
from app.payments.reconciliation import (
    DiscrepancyKind as K, InternalEntry, Policy, ReconciliationEngine, Severity,
)

NOW = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)
SINCE, UNTIL = NOW - timedelta(days=2), NOW + timedelta(minutes=1)
IN, OUT = Direction.INBOUND, Direction.OUTBOUND


def mine(key="R1", amount=100_000, status="verified", at=None, **kw):
    return InternalEntry(key=key, direction=kw.pop("direction", IN), amount_kobo=amount, status=status, occurred_at=at or NOW - timedelta(hours=20), **kw)


def theirs(ref="P1", amount=100_000, status=TxnStatus.SUCCESSFUL, at=None, reference="R1", **kw):
    return ProviderTransaction(provider_ref=ref, direction=kw.pop("direction", IN), amount_kobo=amount, status=status, occurred_at=at or NOW - timedelta(hours=20), reference=reference, **kw)


def rec(internal, external, **policy):
    return ReconciliationEngine(policy=Policy(**policy)).reconcile(internal, external, since=SINCE, until=UNTIL, now=NOW)


def kinds(res): return sorted(d.kind.value for d in res.discrepancies)


def test_clean_books_balance():
    r = rec([mine()], [theirs()])
    assert r.balanced and not r.discrepancies and len(r.matched) == 1
    assert r.internal_in_kobo == r.external_in_kobo == 100_000


def test_match_by_provider_ref_when_provider_does_not_echo_our_reference():
    r = rec([mine(provider_ref="P9")], [theirs(ref="P9", reference=None)])
    assert r.balanced and len(r.matched) == 1


def test_virtual_account_credit_matched_on_account_amount_and_time():
    r = rec([mine(key="VA-1", account_number="9123456789", at=NOW - timedelta(hours=3))],
            [theirs(ref="X", reference=None, account_number="9123456789", at=NOW - timedelta(hours=3, minutes=20))])
    assert r.balanced and len(r.matched) == 1


def test_account_match_respects_amount_and_window():
    far = rec([mine(key="VA-1", account_number="9123456789")], [theirs(ref="X", reference=None, account_number="9123456789", at=NOW - timedelta(hours=30))])
    assert kinds(far) == ["missing_at_provider", "unrecorded_at_platform"]
    diff = rec([mine(key="VA-1", account_number="9123456789")], [theirs(ref="X", reference=None, account_number="9123456789", amount=99_000)])
    assert kinds(diff) == ["missing_at_provider", "unrecorded_at_platform"]


def test_amount_mismatch_is_critical_with_signed_delta():
    r = rec([mine(amount=100_000)], [theirs(amount=90_000)])
    d = r.discrepancies[0]
    assert d.kind == K.AMOUNT_MISMATCH and d.severity == Severity.CRITICAL and d.delta_kobo == -10_000 and not r.balanced


def test_tolerance_absorbs_rounding_only_when_configured():
    assert not rec([mine(amount=100_000)], [theirs(amount=99_999)]).balanced
    assert rec([mine(amount=100_000)], [theirs(amount=99_999)], amount_tolerance_kobo=1).balanced


def test_we_say_paid_provider_says_failed_or_reversed():
    for st in (TxnStatus.FAILED, TxnStatus.REVERSED):
        r = rec([mine()], [theirs(status=st)])
        assert kinds(r) == ["status_mismatch"] and r.discrepancies[0].severity == Severity.CRITICAL


def test_provider_succeeded_but_we_still_show_pending():
    r = rec([mine(status="pending")], [theirs()])
    assert kinds(r) == ["unrecorded_success"] and r.discrepancies[0].severity == Severity.WARNING


def test_missing_at_provider_is_info_inside_grace_and_critical_after():
    fresh = rec([mine(at=NOW - timedelta(hours=2))], [])
    assert kinds(fresh) == ["pending_at_provider"] and fresh.balanced                      # timing noise must not raise alarms
    old = rec([mine(at=NOW - timedelta(hours=20))], [])
    assert kinds(old) == ["missing_at_provider"] and old.discrepancies[0].severity == Severity.CRITICAL and not old.balanced


def test_unsettled_internal_entries_without_a_provider_trace_are_normal():
    assert rec([mine(status="pending"), mine(key="R2", status="failed")], []).balanced


def test_money_the_provider_moved_that_we_never_recorded():
    r = rec([], [theirs(ref="Z", reference=None, amount=55_000)])
    d = r.discrepancies[0]
    assert d.kind == K.UNRECORDED_AT_PLATFORM and d.severity == Severity.CRITICAL and d.delta_kobo == 55_000


def test_provider_failures_we_never_recorded_are_not_alarming():
    assert rec([], [theirs(status=TxnStatus.FAILED), theirs(ref="P2", status=TxnStatus.PENDING)]).balanced


def test_duplicate_statement_line_is_flagged_and_not_double_counted():
    r = rec([mine()], [theirs(), theirs()])
    assert "duplicate_at_provider" in kinds(r) and r.external_in_kobo == 100_000


def test_matching_is_one_to_one():
    old = NOW - timedelta(hours=10)   # past the grace period, so the unmatched one is a real finding
    a = dict(account_number="9123456789", at=old)
    r = rec([mine(key="A", **a), mine(key="B", **a)], [theirs(ref="X", reference=None, account_number="9123456789", at=old)])
    assert len(r.matched) == 1 and kinds(r) == ["missing_at_provider"]


def test_directions_never_cross_match():
    r = rec([mine(direction=OUT, key="OUT1")], [theirs(reference="OUT1")])
    assert "missing_at_provider" in kinds(r) and "unrecorded_at_platform" in kinds(r)


def test_entries_after_the_statement_window_are_not_reported_missing():
    assert rec([mine(at=UNTIL + timedelta(hours=1))], []).balanced


def test_payout_side_is_reconciled_too():
    r = rec([mine(key="OUT1", direction=OUT, kind="payout")], [theirs(reference="OUT1", direction=OUT)])
    assert r.balanced and r.internal_out_kobo == r.external_out_kobo == 100_000


def test_fingerprints_are_stable_across_runs():
    a = rec([mine(at=NOW - timedelta(hours=20))], []).discrepancies[0].fingerprint
    b = ReconciliationEngine().reconcile([mine(at=NOW - timedelta(hours=20))], [], since=SINCE, until=UNTIL, now=NOW + timedelta(hours=3)).discrepancies[0].fingerprint
    assert a == b


def test_a_provider_specific_matcher_can_be_added_without_touching_the_engine():
    from app.payments.reconciliation import DEFAULT_MATCHERS
    by_narration = lambda i, e, p: e.counterparty == f"NARR:{i.key}"
    eng = ReconciliationEngine(matchers=(*DEFAULT_MATCHERS, by_narration))
    r = eng.reconcile([mine(key="R7")], [theirs(reference=None, counterparty="NARR:R7")], since=SINCE, until=UNTIL, now=NOW)
    assert r.balanced and len(r.matched) == 1

# Writing a payment adapter

The rest of CREW never names a fintech. It talks to `app/payments/ports.py::PaymentProvider` in the canonical vocabulary of
`app/payments/domain.py`. Ecobank, Verve, Paystack, OPay, Moniepoint... each is one file in `app/payments/adapters/`.
**I have not seen any of these providers' API contracts, so none of their endpoints are implemented or guessed.**
`adapters/ecobank.py` and `adapters/verve.py` are honest skeletons; `adapters/example_http.py` is a working, fictional
provider that shows every translation you will need to write.

## The five-step recipe

1. Copy `adapters/example_http.py` to `adapters/<name>.py`. Set `name` (lower-case, **never rename once live**: old rows keep resolving to it) and `reference_prefix`.
2. Fill in the **mapping worksheet** below from the provider's docs.
3. Implement the required methods, then the optional ones the provider really offers, and set the matching `Capabilities` flags. Claiming a capability you don't implement fails the contract kit.
4. Register it in `registry._bootstrap()` (one line) and add its env vars to `.env.example`.
5. Copy the `TestExamplePayContract` pattern from `tests/test_adapter_contract.py`: subclass `ProviderContract`, feed it **recorded real responses** through a fake `HttpClient`. Then run the provider's sandbox by hand once.

To switch a live system: set `PAYMENT_PROVIDER=<name>` (and optionally `PAYOUT_PROVIDER`). In-flight payments, virtual accounts and payouts keep using the adapter that created them.

## Mapping worksheet (fill this in before writing code)

| Question | Where it goes | Notes |
|---|---|---|
| Amount unit on the wire: kobo int, naira decimal, naira string? | `Capabilities.amount_unit` + `to_provider_amount` / `from_provider_amount` | Never use float. Decimal-naira is the usual trap. |
| How do I pass **our** reference so they echo it back? | `CollectionRequest.reference` → their `merchant_ref`/`reference`/metadata | If they can't echo it, add a reconciliation matcher (see below). |
| Is create idempotent on that reference? | `ProviderHttp.call(..., idempotent=True)` only if yes | Otherwise a retried POST may double-charge; the client won't retry it. |
| Status words → `CollectionStatus` / `PayoutStatus` / `TxnStatus` | Dict in the adapter | Unknown status = raise `ProviderRejected`, never guess. |
| Is `verify` authoritative? Does it return the amount actually paid? | `VerificationResult.amount_kobo` | Report what THEY saw. Never echo `expected_kobo`. |
| Webhook auth: HMAC header? which hash? IP allow-list? basic auth? | `verify_webhook` | Constant-time compare. Header names arrive lower-cased. |
| Webhook payload → events; what is their unique event id? | `parse_webhook` → `WebhookEvent.event_id` | If none exists, derive a stable one; replay-safety depends on it. |
| Virtual accounts: per-payer or shared? expiry? can I close one? | `open/get/close_virtual_account` | Must be idempotent on `reference`. |
| Payout: async? needs recipient/bank code registration first? | `initiate_payout` (+ `resolve_account`) | Return `PENDING` honestly; the final state arrives by webhook or `get_payout`. |
| Statement/transactions endpoint: pagination style, gross vs net, fee field | `list_transactions` | Yield **gross** amounts, fees separate, oldest first. |
| Rate limits / timeouts / retry-after | `ProviderHttp(max_attempts, timeout)` | GETs retry automatically. |
| Sandbox vs live base URL and key names | adapter `__init__` env vars | Never log or store secrets; use `redact()` on anything kept as `raw`. |

## Reconciliation needs three things from you

The engine (`payments/reconciliation.py`) is provider-independent. For a new provider to reconcile properly:

- `list_transactions` (best) **or** webhooks (fallback: weaker, the run says `source: webhook_log`). A provider with neither is refused, never reported "balanced".
- Something to match on: our `reference` echoed on each statement line, or their `provider_ref` stored on our payment, or the virtual account number + amount + time.
- If none of those exist (rare), add a matcher: `ReconciliationEngine(matchers=(*DEFAULT_MATCHERS, my_matcher))`, e.g. parse our reference out of the narration.

## Error contract

Raise only the `ProviderError` family (`app/payments/errors.py`). The API maps them: `NotSupported`→501, `ProviderRejected`→422,
`SignatureInvalid`→401, `MalformedPayload`→400, everything else (`Unavailable`, `AuthError`, `NotConfigured`)→502.

## What the contract kit proves (and what it can't)

It proves: honest capabilities, integer-kobo integrity, repeatable verification, idempotent create/payout, authentic-only webhooks,
canonical events, terminating pagination, errors stay inside the family. It can't prove your mapping matches the provider's real
behaviour: that needs recorded real responses and one manual sandbox run before any real money moves.

## Money-safety rules the platform enforces regardless of adapter

Amount mismatch → payment parked `unverified`, never credited. Transfer to a closed/finished/over-limit virtual account → held for review.
Webhook replays → harmless. Unknown references/accounts → stored `unmatched` and shown by reconciliation, never lost. Payout references
are deterministic per milestone (retries can't pay twice); a definitively failed payout gets a new attempt reference.
Holding client funds is custody: validate the model with a licensed partner before real money moves.

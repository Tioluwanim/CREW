# CREW backend

FastAPI + SQLAlchemy service behind the frontend contract (`../openapi.yaml`), plus the workspace pivot:
scope → agreement → funding → delivery → approval → release, with a no-signup client link.

The hand-written deterministic engine in `intelligence/` is the source of truth for every number.
**Not in this pass (by design):** the AI agent and the deep-learning forecaster. They plug in through
`app/extension/` (see "Handoff").

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # export the variables (or use your own loader)
python -m scripts.seed      # demo workspace: amara@crew.demo / crew-demo-1234
uvicorn main:app --reload   # http://localhost:8000/docs
pytest                      # 134 tests
python -m scripts.export_openapi   # full spec -> openapi.generated.json
```

Frontend: `NEXT_PUBLIC_USE_MOCK_API=false`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api`.
To run the current frontend against the API before it sends tokens, set `CREW_DEMO_MODE=true DEMO_AUTO_AUTH=true`:
requests with **no** header act as the demo user (a wrong token is still 401). Production refuses to boot with either flag.
**The frontend service layer does not send an auth header yet** (five `fetch` calls in `src/services/*`). Everything except `/feedback`, `/share/*`,
`/auth/*` and `/health` needs `Authorization: Bearer <token>` (from `POST /api/auth/demo` with
`CREW_DEMO_MODE=true`, or `/api/auth/login`). Add it in `src/services/*`.

## Agent (Groq) and forecast

**Copilot agent.** Set `GROQ_API_KEY` (free key at https://console.groq.com/keys) and the copilot (`POST /api/copilot/chat`) is answered by a Groq-hosted model
(`GROQ_MODEL`, default `llama-3.3-70b-versatile`). `AGENT_RUNTIME=null` forces the deterministic template answers.
- The model never does the math: it is given the engine's figures and may only restate them. Any naira amount in its reply that is not in those figures
  discards the reply and the deterministic answer is used (`fallbackReason: "ungrounded_amount"`).
- Only engine figures are sent to Groq: no names, emails, phone numbers or ids.
- No key, a timeout, a rate limit (429) or malformed output all fall back to the deterministic answer. The response's `agent` field says which one answered.
- It only answers. It has no tools and cannot change a project.

**Forecast.** `FORECASTER=learned` (default) makes `GET /api/forecast/series` return the cash curve with `low`/`high` bands from payment-timing scenarios
(clients pay on time / `expectedDays` late / later still). `delay.source` says where the expected delay came from: `gru` (a trained model that beat its baseline),
`history` (your completed projects, shrunk toward a craft prior) or `prior`. `learned` is `true` only for `gru`. Amounts always come from the deterministic engine.
Train the GRU with `POST /api/dl/train` once there are enough completed projects (the existing data-quality gate still applies). The GRU code now masks padding,
scales its inputs and keeps the best epoch on the later validation slice; a model that does not beat "always predict the average delay" is never used.
`FORECASTER=baseline` returns the plain deterministic curve.

## Layout

```
app/models.py             tables (all money = integer kobo)
app/routers/core.py       openapi.yaml endpoints + project/cost CRUD, profile, consent, notifications
app/routers/workspace.py  lifecycle, deliverables, change requests, invoices, share link, timeline,
                          reconciliation, intelligence, genome, data export, copilot, extension status
app/routers/public.py     /share/{token}/*  client actions, no account
app/routers/payments.py   /payments/verify, /payments/{id}, signed webhook
app/services/             finance (engine adapter), lifecycle, payments, events, portfolio, intelligence_service
app/extension/            interfaces + registry: seams for the agent and DL forecaster
intelligence/             your deterministic engine (small fixes, listed below)
```

## Production-like stack and migrations

```bash
docker compose up --build        # Postgres 16 + API; runs `alembic upgrade head`, then seeds the demo
alembic upgrade head             # against any DATABASE_URL; set AUTO_CREATE_TABLES=false
alembic revision --autogenerate -m "what changed"    # after editing app/models.py
```

`tests/test_stage2.py` proves the migration matches the models (`alembic check`) and that the schema compiles for PostgreSQL.
**Not yet run against a live Postgres server** (none was available here): run `docker compose up` once before relying on it.
`CREW_ENV=production` refuses to boot with the default JWT/webhook secrets, SQLite, or the demo flags.

## Follow-ups (scheduled)

`python -m scripts.sweep` (cron) or `POST /api/system/sweep` with `X-Cron-Secret` (enabled only when `CRON_SECRET` is set):
overdue invoices, invoices due within 2 days, and deliveries the client has not reviewed for 3 days each create one
notification and one timeline event, then stay quiet (idempotent). Nothing is sent to clients yet; these are creator-side alerts.

## Client emails (outbox)

`POST /invoices/{id}/send` and `/remind` (max one per invoice per day) and verified payments (receipt) write a message to
an outbox, then deliver it. Failures are kept and retried (5 attempts; the sweep retries them). Nothing is ever auto-sent to
a client without the creator sending or reminding, and clients without an email are skipped.
- `SMTP_HOST` set -> real delivery through stdlib `smtplib` (status `sent`).
- `SMTP_HOST` empty -> console fallback, status **`logged`**, not `sent`, so dev output can't be mistaken for delivery.
- **SMS/WhatsApp/USSD: no provider is wired.** Those messages fail with "No provider configured" until you implement
  `Sender` for one (`app/services/messaging.py`). I did not guess a provider's API.
`GET /projects/{id}/messages` shows status and attempts, never the recipient or body.

## Safe retries

`Idempotency-Key` header on `POST /projects`, `POST /projects/{id}/invoices` and `POST /share/{token}/pay`: same key and
request replays the first response (`Idempotent-Replay: true`); same key with a different request is a 422. Keys are per
user, written in the same transaction as the work, and purged after 24h by the sweep. Payment verification and the webhook
also take a row lock (`SELECT … FOR UPDATE`, effective on PostgreSQL; a no-op on SQLite).

## Account security and data rights

- 5 failed logins lock the account for 15 minutes (429). Success resets the counter.
- `POST /auth/change-password` and `/auth/logout-all` invalidate every previously issued token (token version).
- `GET /me/export` returns everything held for the account (no password hash or share tokens).
- `DELETE /me` (password + `"confirm": "DELETE"`) erases the account and all its data, and kills its client links.
  Payment and invoice records may carry legal retention duties: **confirm with counsel before launch** whether erasure should
  become anonymisation for financial records.

## Estimate vs actual

Costs keep `estimatedAmount` (defaults to the amount at creation; the first later edit freezes the old figure as the estimate).
`/profile.averageMaterialOverrunPct` and the margin recommendation in `/projects/{id}/intelligence` now use this history
(10% prior until there is data).

## Lifecycle

`brief → agreed → funded → in_progress → in_review → approved → released → closed`

| Move | Who | Guard |
|---|---|---|
| brief → agreed | client link | ≥1 deliverable; milestones sum to price |
| agreed → funded | automatic | verified payments ≥ deposit |
| agreed/funded → in_progress | creator | deposit required if deposit > 0 |
| in_progress → in_review | creator | ≥1 deliverable delivered |
| in_review → in_progress | client (revision) | flags revisions beyond `revisionsIncluded`, notifies creator |
| in_review → approved | client | every deliverable approved |
| approved → released | creator (`/release`) | funded milestones only, paid via the provider |
| released → closed | creator | |

Every step is written to an append-only, hash-chained timeline (`GET /projects/{id}/timeline` reports `integrity`).
The client view never exposes costs or margin.

## Money and rules

- API: integer naira. DB and engine: integer kobo. Dates: `Africa/Lagos` calendar dates.
- Only **creator-funded** costs reach the engine (same rule as `src/lib/finance.ts`).
- `/projects/{id}/financials` takes exposure, gap, profit and margin from the engine; the 5-checkpoint series is built in
  `services/finance.py` with the frontend's event ordering (same-day inflows first). The Aso-ebi demo matches:
  deposit ₦192,000, exposure ₦133,000, profit ₦155,000, margin 32.29% (`tests/test_finance.py`).

## Decisions to review

1. Dashboard `cashGap` = deepest dip of the workspace-wide forecast including current cash (the mock used one project's exposure), so it differs once you leave MSW.
2. `cashPosition` = starting cash + verified receipts − creator costs already due − verified money held for unreleased milestones. Enter starting cash as of signup; seed history makes the demo figure illustrative.
3. Overrun is measured on costs in the `materials` category only, as a plain mean across costs (not weighted by amount).
4. `pricingPower` and `cashflowHealth` in `/genome` are provisional heuristics (flagged in the response); `GenomeEngine` implements only two of four scores.
5. Price and deposit lock after `agreed`; changes go through a change request (accepted → price and a new milestone).

## Payments: provider-agnostic

Everything payment-related goes through one contract, `app/payments/ports.py` (`PaymentProvider`), in one vocabulary,
`app/payments/domain.py`. Swapping fintech = one adapter file + `PAYMENT_PROVIDER=<name>` (and optionally `PAYOUT_PROVIDER`).
**Read `docs/PAYMENT_ADAPTERS.md` to add Ecobank, Verve, Paystack, OPay, Moniepoint, ...**

| Piece | Where |
|---|---|
| Canonical types (kobo, references, statuses, events) | `app/payments/domain.py` |
| The abstract contract (+ capability flags) | `app/payments/ports.py` |
| Shared HTTP (retries only where safe, error mapping, redaction) | `app/payments/http.py` |
| Provider-independent reconciliation engine (pure function) | `app/payments/reconciliation.py` |
| Registry (`PAYMENT_PROVIDER`, `PAYOUT_PROVIDER`) | `app/payments/registry.py` |
| Adapters | `app/payments/adapters/` (`sandbox` full, `ecobank` + `verve` skeletons, `example_http` fictional template) |
| Adapter conformance test-kit | `app/payments/contract.py` |
| Orchestration (collections, virtual accounts, payouts) | `app/services/payments.py` |
| Webhook intake (one URL per provider) | `POST /api/webhooks/payments/{provider}` |
| Runner + persisted findings | `app/services/reconcile_runner.py`, `POST /api/system/reconcile` |

**Status of the real rails: Ecobank and Verve are skeletons.** They declare no capabilities, refuse every call with a clear
message, and use no invented endpoints. Implement them with credentials and the providers' docs. The sandbox is a complete
in-memory reference (virtual accounts, async payouts, statement) and moves no real money.

- **Virtual accounts:** `POST /projects/{id}/virtual-account` (or the client asks via the share link). Credits are matched to the project by account number; amount mismatch, overpayment, closed account or finished project => held for review, never guessed.
- **Payouts:** creator sets `PUT /profile/payout-account` (bank name is looked up when the provider supports it, so a typo can't pay a stranger). Async payouts stay `releasing` until the provider confirms; failures return the money to held and retry under a new reference.
- **Reconciliation:** compares our books to the provider's statement (or, for providers without one, our stored webhook log: the run says which, and it is the weaker check). Findings are deduplicated across runs, attributed to projects, visible to creators without provider internals, and resolved by operators (`credit_to_project` or `ignore` with a note). Timing lag inside a 6h grace period is `info`, not an alarm. Auto-posting is off by default.
- Sandbox helpers (non-production, sandbox provider only): `POST /dev/sandbox/transfer`, `POST /dev/sandbox/payouts/{ref}/complete`, `SANDBOX_ASYNC_PAYOUTS=true`.
- Holding client funds until approval is custody. Validate with a licensed partner before real use.

## Changes to your intelligence files

- `cost_buffer.py`, `financial_engine.py`, `recommendation.py`: `import money` → `from intelligence import money` (import failed).
- `cost_buffer.py`: `money.to_kobo` does not exist → `money.naira_to_kobo`.
- `dates.py`: added `project_future_date` (imported by `forecast.py`, was missing).
- `simulation.py`: it mutated frozen `CostDTO`s (crash) → stressed copies via `dataclasses.replace`.
- Left alone: `FinancialEngine` counts client-funded costs (the adapter filters them first); `evaluate_deposit` floors the recommended % (can under-recommend by <1 point).
- Regression tests: `tests/test_intelligence_layer.py`.

## Handoff to Antigravity (agent + DL)

Pipeline: `payments/costs → DB → transactions (normalized) → GET /api/data/normalized → intelligence + DL`.

- **Forecaster**: implement `CashflowForecaster` (`app/extension/interfaces.py`), `register_forecaster(...)`, set `FORECASTER`. Served at `GET /api/forecast/series` (`learned: false` today).
- **Agent**: implement `AgentRuntime`, `register_agent(...)`, set `AGENT_RUNTIME`. `POST /api/copilot/chat` already passes engine-computed grounding facts.
- `AgentRuntime.act_for_client_link` is the hook for the execution agent behind the shareable link.
- Verify wiring with `GET /api/system/extensions`.

## Known gaps

Postgres path is untested against a live server (see above). Rate limiting is in-memory (single process). No SMS/WhatsApp/USSD provider; creator alerts are in-app only. Idempotency covers three create endpoints, not all. Login lockout is per account, not per IP. Ecobank and Verve are skeletons pending credentials and docs. Payout account numbers are stored unencrypted (encrypt at rest before production).

# Presenting CREW, and getting Ecobank and Verve keys

Facts below were read from the linked pages on 2026-10-06. Where a page did not say, this file says so. Re-check before you rely on a date or a requirement.

## 0. Make "Open workspace" start at sign-up

The app shows the built-in demo whenever it is not pointed at a backend. To get sign-up, sign-in and onboarding:
1. Host the API (`backend/`, FastAPI) and set its `CORS_ORIGINS` to your frontend's URL.
2. On the frontend host set `NEXT_PUBLIC_API_BASE_URL=https://<your-api>/api` (and leave `NEXT_PUBLIC_USE_MOCK_API` unset or `false`).
3. Rebuild and redeploy the frontend. `NEXT_PUBLIC_*` values are baked in at build time, so changing them without a rebuild does nothing.
Locally: run the API on port 8000 and set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api` in `.env.local`, then restart `next dev`.
"Explore the demo" keeps using demo data either way.

## 1. Getting keys

### Ecobank (Ecobank Developer Portal)
What the portal documents:
1. Register: Sign In, then "Continue as Partner", then the multi-step sign-up with email verification and profile.
2. Subscribe to products under Products (Collections, Payments, Account Services, Bill Payment). Each subscribed product has its own primary and secondary key.
3. Three environments: Sandbox (static, predefined responses), UAT (production-like credentials, issued after sandbox testing), Production (needs finished test documentation and clearance from Ecobank's business team).
4. Rate limits apply; build retry and backoff.

Not stated by the pages: whether virtual accounts, account-name verification or payouts are separate products, or business-registration requirements. Ask in the portal or through the InnovateX contacts.

How it maps to this repo: set `PAYMENT_PROVIDER=ecobank` and fill `ECOBANK_BASE_URL`, `ECOBANK_CLIENT_ID`, `ECOBANK_CLIENT_SECRET`, `ECOBANK_WEBHOOK_SECRET` in `backend/.env`. The Ecobank adapter is still a skeleton: it needs the real endpoint paths and signature scheme from the portal docs before it can run. Until then the sandbox provider runs the same code paths.

### Verve (through Interswitch)
Verve is Interswitch's card scheme, so you integrate through the Interswitch Developer Console, not a separate Verve portal.
1. Register on the console, create a project, and you get a Client ID and Secret (OAuth 2 access tokens) for test mode.
2. Test in sandbox.
3. To go live, request access in the console's Permissions tab, pick the APIs, and request approval for Live mode. Interswitch reviews it.
4. KYC for live: individual business needs name, phone, date of birth and BVN; a registered business needs contact person, business class, Tax ID and KYC documents. The Card Payments API additionally needs a valid CBN licence or PCI DSS certificate. Bulk transfer or payout needs a valid licence.

Honest consequence: as a student team you will likely get sandbox keys quickly but not live card-payment access. Plan to demo in sandbox, and say so. Live card acceptance would normally sit behind a licensed partner, which is exactly why the pitch routes money through Ecobank.

How it maps to this repo: `VERVE_BASE_URL`, `VERVE_CLIENT_ID`, `VERVE_CLIENT_SECRET`, `VERVE_WEBHOOK_SECRET`. The Verve adapter is also a skeleton.

## 2. Presenting at InnovateX

What the event page states: finale 30 October 2026; prize pool ₦20m (₦5m, ₦4m, ₦3.5m, ₦2.5m, ₦1m for places 1 to 5); teams of four; tertiary students with valid school ID; participants must hold an active Blaze account; judges from Ecobank, Paystack and NSIA. It does not state judging criteria or pitch length, so ask the organisers and rehearse a 3-minute and a 5-minute version.

### Story, in order
1. Problem (20s): a Nigerian creative takes a job, pays for materials upfront, and the client pays 3 weeks late. Cash gaps, scope creep and unpaid revisions are what sink them.
2. Open the live product, not slides (60s): sign up, onboarding, link the Ecobank payout account.
3. Create a project: price, deposit, costs. Show the deposit slider and the shaded forecast band moving. Say "the math is deterministic; the AI only explains it".
4. Send the invoice, open the client link in a second tab as the client (no signup): accept a change request, pay by bank transfer.
5. Verify the payment and show the project move to funded, then the timeline.
6. Ask the Copilot "can I afford to start?" and show that it only quotes engine numbers (the grounding check discards an invented amount).
7. Close on Ecobank (30s): CREW turns every creative into a structured, verifiable Ecobank customer: payout account, virtual account per project, payment history that can support credit later.

### Be honest about these, because judges will probe
- Payments run on the sandbox provider; Ecobank and Verve adapters wait on credentials. Say "sandbox today, Ecobank rail next", not "integrated".
- The forecast band is payment-timing scenarios, not a statistical confidence interval. The caption on the dashboard says whether the delay came from a trained model or a starting estimate.
- The GRU only counts as learned when it beats its baseline on held-out data.
- Funded/released are bookkeeping states, not escrow or custody.

### Demo safety
Keep "Explore the demo" as the fallback if the network fails. Pre-create the live account and project before you go on stage. Have a short screen recording ready.

## Sources
- [Ecobank developer portal](https://developer.ecobank.com/app/index.xhtml)
- [Ecobank API getting started](https://apimuat-developer.ecobank.com/documentation/getting-started)
- [InnovateX 2026](https://www.innovatex.africa/)
- [Interswitch developer portal](https://developer.interswitchgroup.com/)
- [Interswitch KYC requirements](https://docs.interswitchgroup.com/docs/kyc-requirements)
- [How to use the Interswitch Developer Console](https://medium.com/interswitch-engineering-blog/how-to-use-the-interswitch-developer-console-74aa29971088)

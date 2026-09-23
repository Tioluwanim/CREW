---
applyTo: "src/lib/finance.ts,src/lib/kobo.ts"
---
# Financial math rules
- Never use floating point for money. All amounts pass through toKobo/fromKobo at the boundary.
- Every new function here needs a corresponding unit test with at least one rounding edge case.
- Do not modify rounding behavior without flagging it explicitly in the PR description — this is the highest-blast-radius file in the app.
# CREW — Copilot instructions

## Stack
- Next.js (App Router), TypeScript strict mode, React 19.
- Tailwind v4, CSS-first `@theme` tokens in `src/app/globals.css` — never hardcode hex colors, always use the existing `--color-ink-*`, `--color-bone-*`, `--color-thread-*`, `--color-gold-*`, `--color-verified-*` tokens.
- Fonts: Fraunces (display/serif, narrative moments only), Inter (UI/body), IBM Plex Mono (numbers only, via the `.num` class).
- Animation split (do not blur this line): GSAP + ScrollTrigger + Lenis for the landing-page scroll narrative only; Framer Motion for product UI micro-interactions. Both must respect `prefers-reduced-motion`.
- All GSAP/Lenis/R3F/Framer Motion components must be marked `'use client'`.
- Money is never handled in floats. All intermediate math goes through `lib/kobo.ts` (integer kobo). `lib/finance.ts` owns every financial calculation — no other file computes a financial number.
- `services/copilot.ts` follows "math first, AI explains": numbers always come from `lib/finance.ts`; any LLM call may only phrase/explain pre-computed numbers, never generate its own.
- API contract lives in `openapi.yaml` — do not hand-invent request/response shapes; check it first.

## Non-negotiables
- Never put a secret/API key in a `'use client'` file, in an env var without a server-only convention, or in anything that ends up in the client bundle.
- Every interactive element needs a visible `focus-visible` state and a real accessible name.
- Every animation needs a working `prefers-reduced-motion` fallback.
- Reuse `src/components/ui/primitives.tsx` (Button, Card, Pill, StatLabel/Value) — don't invent parallel one-off button/card styles.

## When generating code
- Prefer the `useGSAP()` hook from `@gsap/react` for new GSAP code, not manual `gsap.context()` in `useEffect`.
- Prefer Server Components by default; only add `'use client'` where interactivity/animation/browser APIs require it.
- Match existing file/folder structure under `src/features/<name>/` for any new feature work.
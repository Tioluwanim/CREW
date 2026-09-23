# CREW Rebuild — Next.js + SDK Notes, and the Full GitHub Copilot Prompt Pack

## A. On choosing Next.js

You said you "don't know why" — here's the honest version of why it's a defensible call for CREW specifically, plus the real cost, so it's a decision and not a hunch:

**Legitimate reasons it fits your project (not just default hype):**
- Your landing page is public-facing marketing copy that wants to be crawled and indexed — SSR/SSG genuinely helps here, and your current Vite SPA can't do that without extra tooling.
- Your `copilot` feature (see §B) will eventually need a server-side AI call with a secret API key. Next.js Route Handlers give you that server boundary natively, in the same repo, instead of standing up a separate Node service just for that.
- One deploy target (Vercel or similar) for both the marketing site and the app, instead of coordinating a static host + a separate API host.

**The real cost, so it's not a surprise mid-migration:**
- Every component that uses GSAP, Lenis, React Three Fiber, or Framer Motion must be explicitly marked `'use client'` — these libraries touch the DOM/`window` and cannot run as React Server Components. Your entire landing-page animation layer becomes a client-component subtree hanging off a server-rendered shell. This is mechanical but every file needs the audit.
- Your dashboard (`/app/*` routes, post-login) gains nothing from SSR — it'll mostly end up as client components anyway (TanStack Query fetching client-side, same as today). Don't fight this; let those routes be client components and don't force server-fetching patterns onto authenticated, highly-interactive screens just because the framework offers them.
- This is a real migration, not a config flag — routing (`react-router-dom` → file-based App Router), env var conventions (`VITE_*` → `NEXT_PUBLIC_*`/server-only), and build tooling all change.

Decision respected — the prompt pack below assumes Next.js App Router from this point on.

---

## B. Do you need SDKs? (Specifically: the "AI intelligence" / Copilot feature)

Checked your actual code before answering this, because it changes the answer: **`getCopilotInsight()` in `src/services/copilot.ts` is currently 100% deterministic, rule-based code — there is no LLM call anywhere in the repo today.** The code comment even states the design principle explicitly: *"math first, AI explains" — this function only ever reads numbers that were already computed by lib/finance, it never derives a new financial conclusion of its own.* That's a good, deliberate boundary. Keep it even after you add a real model.

**So: you don't need an SDK for what exists today.** You need one the moment you want the "explains" part to become real generative text (a natural-language insight instead of a template string) or a chat-style "ask copilot" interface. When you get there:

- **Use the Vercel AI SDK** (`ai` package + `@ai-sdk/anthropic`), not the raw `@anthropic-ai/sdk`, specifically *because* you're on Next.js — `streamText()` in a Route Handler pairs with the `useChat()`/`useCompletion()` React hooks with almost no boilerplate, and it keeps you provider-agnostic if you ever want to swap or add a model.
- **The API key never goes in a client component or a `NEXT_PUBLIC_*` env var.** It lives server-side only, read inside a Route Handler (`app/api/copilot/route.ts`), called from the client via `fetch`/`useChat`. This is the single most common way "SDK" questions turn into real security incidents — get this boundary right on day one.
- **Keep the math-first boundary alive at the prompt level:** pass the already-computed numbers (`cashGap`, `expectedProfit`, `gapDate`, etc.) into the model as data in the prompt, and instruct it to only phrase/explain them — never ask the model to compute a financial figure itself. This is the exact same architectural rule your current deterministic code already follows; a model call doesn't get to violate it.

**Other things you don't need an SDK for:** GSAP, Lenis, Framer Motion, Three.js/React Three Fiber are libraries, not SDKs — no API keys, no backend, current versions already checked as up to date in the first audit. **What you do need to flag separately (backend, not frontend):** `EcobankBadge.tsx` states your payment verification is designed against Ecobank's sandbox API as the primary rail, with no real integration yet — that's a server-side banking integration your backend team owns; it never runs from the frontend and isn't part of this frontend SDK question, but make sure someone owns that contract too (see the OpenAPI prompt below — it should cover payment/verification endpoints as well).

---

## C. `.github/copilot-instructions.md` — set this up first, before any prompt below

GitHub Copilot reads this file on every interaction if it's committed at the repo root under `.github/`. Without it, you'll re-explain your stack in every single prompt. Create this file first:

```markdown
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
```

For anything that should only apply to specific folders (e.g. stricter rules just for `lib/finance.ts` or `lib/kobo.ts`), add a scoped file instead of cramming everything into the one repo-wide file:

```markdown
---
applyTo: "src/lib/finance.ts,src/lib/kobo.ts"
---
# Financial math rules
- Never use floating point for money. All amounts pass through toKobo/fromKobo at the boundary.
- Every new function here needs a corresponding unit test with at least one rounding edge case.
- Do not modify rounding behavior without flagging it explicitly in the PR description — this is the highest-blast-radius file in the app.
```
Save as `.github/instructions/finance.instructions.md`.

---

## D. The prompt pack — run these in order, one at a time, in GitHub Copilot Chat

A note on format: these are written as **Copilot Chat prompts**, meant to be pasted one at a time (not run unattended like an autonomous agent task) — reference the actual files with `#file:` so Copilot grounds itself in your real code instead of guessing, and review the diff before accepting each one. Don't chain multiple prompts into one mega-request; Copilot's output quality degrades and gets harder to review the larger the change.

**Prompt 1 — Framework migration**
> "Migrate this Vite + React Router SPA to Next.js 16 App Router. Move `src/pages/*` into `app/` following App Router file conventions. Mark every component that uses `#file:src/hooks/useGsapReveal.ts`, `#file:src/hooks/useLenisScroll.ts`, GSAP, Lenis, React Three Fiber, or Framer Motion with `'use client'` at the top — list every file you had to mark this way so I can review the boundary. Keep TanStack Query for client-side data fetching in the `/app` (product) routes rather than converting them to server components — those routes are behind auth and gain nothing from SSR. Convert `VITE_*` env vars to the Next.js convention, keeping secrets server-only."

**Prompt 2 — Fonts**
> "Move font loading off the `@import url(...)` in `#file:src/index.css` and into `next/font/google` for Fraunces, Inter, and IBM Plex Mono (or self-host via `next/font/local` if you pull the full variable-font files). Load the full Fraunces variable font (optical size + weight axes), not just the four static weights currently loaded. Ensure `next/font`'s automatic fallback-metric matching is in effect so there's no layout shift on font swap. Don't change any other styling."

**Prompt 3 — PWA via Serwist (not `next-pwa`, which is effectively superseded)**
> "Add PWA support using `@serwist/next` (not the older `next-pwa` package). Generate a web app manifest via `app/manifest.ts` using our existing `--color-*` tokens for theme/background color, generate a full icon set including maskable icons from `#file:public/favicon.svg` and `#file:public/icons.svg`, and configure a service worker with network-first caching for API routes and cache-first for static assets/fonts. Confirm it works correctly in App Router and doesn't break dev-mode HMR."

**Prompt 4 — Design direction (do not let it write code yet)**
> "Before writing any code: propose 3 concrete art-direction options for the landing page that push further into the 'atelier ledger / textile-dye' brief documented in `#file:src/index.css`. Each option needs a specific answer to: how paper/fabric texture actually appears (not flat color fills), what the 3D hero scene visually pays off at the 'but where did the money go' beat, and how motion timing/easing varies by section instead of reusing one fade-and-rise everywhere. Describe each option in detail — do not generate components yet."

**Prompt 5 — Rebuild the landing page**
> "Using [option X from Prompt 4], rebuild the landing page as a Server Component shell with client-component islands for anything animated. Preserve the existing reduced-motion fallbacks, `focus-visible` states, and the GSAP/Lenis-for-narrative vs. Framer-Motion-for-UI split. Migrate GSAP scroll-reveal logic to the official `useGSAP()` hook from `@gsap/react`. Vary animation timing/easing meaningfully per section."

**Prompt 6 — API contract**
> "Write an OpenAPI 3.1 spec (`openapi.yaml`) covering every endpoint called from `#file:src/services/projects.ts`, `#file:src/services/forecast.ts`, `#file:src/services/financials.ts`, `#file:src/services/clients.ts`, `#file:src/services/feedback.ts`, based on their current shapes and `#file:src/types/index.ts`. Include the payment-verification endpoints implied by `#file:src/components/ui/EcobankBadge.tsx` even though they're not implemented yet — mark them clearly as not-yet-live. Then regenerate the TypeScript types from the spec with `openapi-typescript`, and update the MSW handlers so they validate against the same spec."

**Prompt 7 — Wire a real AI call for Copilot (only once you actually want this)**
> "Add a Route Handler at `app/api/copilot/route.ts` using the Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) with `streamText()`. It must take the already-computed values from `#file:src/services/copilot.ts` (`cashGap`, `expectedProfit`, `gapDate`, `paymentStatus`) as structured input and only ever phrase/explain them in the system prompt — explicitly instruct the model not to compute or restate a different number than what it was given. Wire `useChat()` or `useCompletion()` on the client. Keep the API key server-only; show me every file that reads it to confirm it never reaches the client bundle."

**Prompt 8 — First real feature module**
> "Build out `src/features/dashboard/` (currently empty) fully — components, hooks, local state — following the pattern in `#file:src/features/onboarding/`, using `#file:src/components/ui/primitives.tsx` and the design direction from Prompt 4/5. This is the reference implementation for the other 10 empty feature folders; be explicit about the reusable pattern once done."

**Prompt 9 — HCI/accessibility pass**
> "Run an accessibility audit against every finished route: keyboard-only navigation through the whole pinned-scroll landing page, color contrast for every token in `#file:src/index.css` against both bone-50 and white (especially `--color-thread-*` and `--color-gold-*`), and confirm the reduced-motion fallback is fully navigable and not missing content. Report every WCAG 2.2 AA failure found and fix it before moving on."

**Prompt 10 — Repeat for remaining features**
> Run Prompt 8's pattern once per remaining empty folder (`projects`, `clients`, `cashflow`, `invoices`, `payments`, `profit`, `genome`, `copilot`, `settings`, `auth`) — one prompt, one review, per feature. Don't batch them.

**Prompt 11 — Bundle/route audit**
> "Report current JS bundle size per route after the migration. Confirm GSAP/Lenis/Three.js/React Three Fiber code is only included in the landing-page route's client bundle and not leaking into `/app/*` routes via a shared `'use client'` boundary higher up the tree than necessary."

---

## E. When to trust Copilot, and when to critique it hard

Treat this as a graduated-trust list, not a blanket "always review everything" — that's not realistic and you won't do it consistently. Spend your scrutiny where it matters:

**Low scrutiny — spot-check, don't line-by-line review:**
- Boilerplate/scaffolding: new file/folder structure, repetitive CRUD following an established pattern, config files (`next.config.ts`, `tailwind.config`).
- Import path rewrites and other mechanical migration work.
- Test-writing for logic you've already specified clearly (it's good at filling in test cases once the behavior is pinned down).

**High scrutiny — review line by line, every time:**

1. **Anything touching `lib/finance.ts` or `lib/kobo.ts`.** This is a financial product; a silently-wrong rounding rule or a float creeping back into the math path is the single highest-blast-radius bug class you have. Don't trust Copilot's arithmetic reasoning — verify against the existing test suite, and add an edge-case test yourself before accepting a change here, not after.
2. **Accessibility claims.** Copilot will confidently add `aria-*` attributes and say "this is now accessible" — that claim is not evidence. It routinely adds redundant `role`s on semantic elements or misses the actual `aria-live` region that was needed. Verify with `axe`/keyboard-only testing, not by reading the diff and nodding.
3. **API key / secret handling**, especially right after Prompt 7. Explicitly check that the key is read in a server-only context and never appears in a `'use client'` file, a `NEXT_PUBLIC_*` var, or the client bundle. This is the one category where a mistake isn't a bug, it's a breach.
4. **Design/creative decisions.** Copilot has no taste and no memory of the art direction you picked in Prompt 4 beyond what's literally in context — left unconstrained, it regresses hard toward generic Tailwind-template patterns (this is *exactly* the "vibe" problem from the first audit, and Copilot will happily reintroduce it). Reject anything that looks like a stock SaaS card grid unless you specifically asked for one.
5. **GSAP/ScrollTrigger cleanup.** Copilot frequently omits proper `revert()`/cleanup in generated animation hooks. In a Next.js App Router app specifically, more of the tree stays mounted across client-side navigations than it did in your old SPA, so an uncleaned `ScrollTrigger` now causes duplicate triggers or memory growth in a way it might not have before — check every new animation hook has real cleanup, not just a hopeful one.
6. **Package/version suggestions.** Its training data lags — it will suggest the deprecated `next-pwa` instead of `@serwist/next`, or the old manual `gsap.context()` pattern instead of `useGSAP()`, unless your `copilot-instructions.md` explicitly steers it away (which is why §C exists). Cross-check any new dependency against current docs before accepting.
7. **"This should work" without you running it.** Always actually run the dev server and test suite before accepting a multi-file change, especially anything from the migration prompts — a plausible-looking diff across 15 files is exactly where a small, real breakage hides.

**General rule of thumb:** the closer a change gets to money math, security boundaries, accessibility, or the visual identity you fought to get right, the less you delegate your judgment — those are the four places where "looks right" and "is right" diverge most often with AI-generated code.
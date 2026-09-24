/**
 * Scroll-progress ranges for each beat of the landing page's opening
 * sequence. Previously duplicated as separate literal arrays in
 * HeroScene.tsx (the 3D scene) and LandingPage.tsx (the 2D text overlay) —
 * both had to happen to use the same numbers by convention, with nothing
 * stopping them drifting apart on a future edit. This is the one place
 * those ranges are defined; both consumers import it.
 *
 * The arc is job -> costs -> cash flow (the gap) -> profit (the resolve),
 * matching the actual product story: a project is profitable on paper,
 * the risk is the timing of the cash, and CREW is what closes that gap.
 */
export const HERO_BEAT_RANGES = {
  job: [0, 0.14],
  materials: [0.14, 0.32],
  costs: [0.32, 0.48],
  deliver: [0.48, 0.62],
  gap: [0.62, 0.78],
  resolve: [0.78, 1],
} as const satisfies Record<string, readonly [number, number]>;

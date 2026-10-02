/**
 * Scroll-progress ranges for each beat of the landing page's opening
 * sequence. Previously duplicated as separate literal arrays in
 * HeroScene.tsx (the 3D scene) and LandingPage.tsx (the 2D text overlay) —
 * both had to happen to use the same numbers by convention, with nothing
 * stopping them drifting apart on a future edit. This is the one place
 * those ranges are defined; both consumers import it.
 *
 * The arc (post-pivot): a brand DMs Kemi -> scope gets agreed -> the brand
 * asks for more -> is that included or extra? (the tension beat) -> CREW
 * makes the classification a two-tap decision instead of an argument (the
 * resolve beat). The beat KEYS are kept as-is (job/materials/costs/
 * deliver/gap/resolve) so the scene and text overlay's existing wiring
 * doesn't need touching — only what each beat represents changed.
 */
export const HERO_BEAT_RANGES = {
  job: [0, 0.14],
  materials: [0.14, 0.32],
  costs: [0.32, 0.48],
  deliver: [0.48, 0.62],
  gap: [0.62, 0.78],
  resolve: [0.78, 1],
} as const satisfies Record<string, readonly [number, number]>;

// Integer minor-unit (kobo) arithmetic, per the requirement that financial
// math is never done in floats. Naira amounts enter and leave at the
// boundary (money.ts formatting, user input); everything in between that
// touches lib/finance.ts should go through here.
//
// 1 naira = 100 kobo. All amounts elsewhere in the codebase are still
// expressed "in naira" as plain numbers for readability (e.g. 480_000
// means ₦480,000) — toKobo/fromKobo convert at the calculation boundary
// so intermediate sums and comparisons happen on integers.

/** Converts a naira amount to integer kobo, rounding half-up. */
export function toKobo(nairaAmount: number): number {
  return roundHalfUp(nairaAmount * 100);
}

/** Converts integer kobo back to a naira amount (still a plain number). */
export function fromKobo(koboAmount: number): number {
  return koboAmount / 100;
}

/** Round-half-up (not banker's rounding) — matches the backend's rounding rule. */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

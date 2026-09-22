// Single source of truth for Naira formatting.
// Never mix currency formats elsewhere in the app — always go through these.

const fullFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'symbol',
  maximumFractionDigits: 0,
});

/** ₦480,000 */
export function formatNaira(amount: number): string {
  return fullFormatter.format(Math.round(amount));
}

/** ₦1.2m / ₦85k — for compact dashboard contexts only. */
export function formatNairaCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    return `${sign}₦${trimTrailingZero(abs / 1_000_000)}m`;
  }
  if (abs >= 1_000) {
    return `${sign}₦${trimTrailingZero(abs / 1_000)}k`;
  }
  return `${sign}₦${Math.round(abs)}`;
}

function trimTrailingZero(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

/** Signed variant for deltas: +₦72,000 / -₦15,000 */
export function formatNairaSigned(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatNaira(Math.abs(amount))}`;
}

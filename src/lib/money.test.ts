import { describe, it, expect } from 'vitest';
import { formatNaira, formatNairaCompact, formatNairaSigned } from './money';

describe('formatNaira', () => {
  it('formats whole naira amounts with the symbol and thousands separators', () => {
    expect(formatNaira(480_000)).toBe('₦480,000');
    expect(formatNaira(72_000)).toBe('₦72,000');
  });

  it('rounds fractional amounts', () => {
    expect(formatNaira(1000.6)).toBe('₦1,001');
  });
});

describe('formatNairaCompact', () => {
  it('formats millions with an m suffix', () => {
    expect(formatNairaCompact(1_200_000)).toBe('₦1.2m');
  });

  it('formats thousands with a k suffix', () => {
    expect(formatNairaCompact(85_000)).toBe('₦85k');
  });

  it('leaves small amounts unabbreviated', () => {
    expect(formatNairaCompact(500)).toBe('₦500');
  });

  it('preserves sign for negative amounts', () => {
    expect(formatNairaCompact(-72_000)).toBe('-₦72k');
  });
});

describe('formatNairaSigned', () => {
  it('prefixes positive amounts with +', () => {
    expect(formatNairaSigned(155_000)).toBe('+₦155,000');
  });

  it('prefixes negative amounts with -', () => {
    expect(formatNairaSigned(-72_000)).toBe('-₦72,000');
  });
});

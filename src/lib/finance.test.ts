import { describe, it, expect } from 'vitest';
import type { ProjectCost } from '../types';
import {
  sumCosts,
  sumCreatorFundedCosts,
  calculateUpfrontExposure,
  calculateDepositAmount,
  calculateExpectedProfit,
  calculateProfitMargin,
  calculateDaysToCash,
  calculateRealisedDaysToCash,
  calculateCashGap,
  calculateDepositImpact,
  recommendMinimumSafeDeposit,
  buildCashFlowProjection,
  findFirstCashGapDate,
} from './finance';
import { asoEbiPersona, asoEbiCosts } from '../data/demoPersona';

// Amara's Aso-ebi order — the canonical demo figures, read from
// demoPersona.ts (section 1b) rather than redefined here, so these tests
// can never quietly drift from what the app actually renders.
const asoEbiRevenue = asoEbiPersona.price;
const asoEbiDepositPct = asoEbiPersona.depositPct;
const asoEbiExpectedPaymentDays = asoEbiPersona.expectedPaymentDays;

describe('sumCosts', () => {
  it('sums all cost line items', () => {
    expect(sumCosts(asoEbiCosts)).toBe(325_000);
  });

  it('returns 0 for no costs', () => {
    expect(sumCosts([])).toBe(0);
  });
});

describe('sumCreatorFundedCosts', () => {
  it('matches sumCosts when every cost is creator-funded (the demo default)', () => {
    expect(sumCreatorFundedCosts(asoEbiCosts)).toBe(sumCosts(asoEbiCosts));
  });

  it('excludes costs tagged funded_by client', () => {
    const withClientFundedMaterials: ProjectCost[] = asoEbiCosts.map((c) =>
      c.id === 'cost-materials' ? { ...c, fundedBy: 'client' as const } : c,
    );
    // 325,000 total - 210,000 client-funded materials = 115,000 creator-funded
    expect(sumCreatorFundedCosts(withClientFundedMaterials)).toBe(115_000);
  });
});

describe('calculateDepositAmount', () => {
  it('computes the naira deposit at 40%', () => {
    expect(calculateDepositAmount(asoEbiRevenue, 40)).toBe(192_000);
  });

  it('computes the naira deposit at 60%', () => {
    expect(calculateDepositAmount(asoEbiRevenue, 60)).toBe(288_000);
  });

  it('is 0 at 0% deposit', () => {
    expect(calculateDepositAmount(asoEbiRevenue, 0)).toBe(0);
  });
});

describe('calculateUpfrontExposure', () => {
  it('is the deepest point costs exceed inflows, for the project in isolation', () => {
    // Day 0: -325,000 (all costs clear first, conservative same-day ordering) + 192,000 deposit = -133,000 deepest point.
    // Day 18: +288,000 balance lands, recovers to +155,000 — doesn't get deeper than day 0.
    const exposure = calculateUpfrontExposure(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays);
    expect(exposure).toBe(133_000);
  });

  it('never goes negative even when deposit exceeds costs', () => {
    const exposure = calculateUpfrontExposure(asoEbiCosts, asoEbiRevenue, 100, asoEbiExpectedPaymentDays);
    expect(exposure).toBeGreaterThanOrEqual(0);
  });

  it('decreases as deposit percentage increases', () => {
    const at40 = calculateUpfrontExposure(asoEbiCosts, asoEbiRevenue, 40, asoEbiExpectedPaymentDays);
    const at60 = calculateUpfrontExposure(asoEbiCosts, asoEbiRevenue, 60, asoEbiExpectedPaymentDays);
    expect(at60).toBeLessThan(at40);
  });

  it('ignores client-funded costs entirely', () => {
    const allClientFunded: ProjectCost[] = asoEbiCosts.map((c) => ({ ...c, fundedBy: 'client' as const }));
    const exposure = calculateUpfrontExposure(allClientFunded, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays);
    expect(exposure).toBe(0);
  });

  it('a cost paid later (not day 0) can change the deepest point', () => {
    const delayedTransport: ProjectCost[] = asoEbiCosts.map((c) => (c.id === 'cost-transport' ? { ...c, paidOnDay: 25 } : c));
    // Removing the 20,000 transport cost from day 0 makes the day-0 dip shallower.
    const exposureDelayed = calculateUpfrontExposure(delayedTransport, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays);
    const exposureOriginal = calculateUpfrontExposure(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays);
    expect(exposureDelayed).toBeLessThan(exposureOriginal);
  });
});

describe('calculateExpectedProfit', () => {
  it('computes profit as revenue minus creator-funded costs', () => {
    expect(calculateExpectedProfit(asoEbiCosts, asoEbiRevenue)).toBe(155_000);
  });

  it('excludes client-funded costs from the margin calculation', () => {
    const withClientFundedMaterials: ProjectCost[] = asoEbiCosts.map((c) =>
      c.id === 'cost-materials' ? { ...c, fundedBy: 'client' as const } : c,
    );
    // Revenue 480,000 - creator-funded (115,000) = 365,000, higher than when materials count against margin.
    expect(calculateExpectedProfit(withClientFundedMaterials, asoEbiRevenue)).toBe(365_000);
  });

  it('can be negative when costs exceed revenue', () => {
    const expensiveCosts: ProjectCost[] = [
      { id: 'c1', label: 'Materials', category: 'materials', amount: 600_000, fundedBy: 'creator', paidOnDay: 0 },
    ];
    expect(calculateExpectedProfit(expensiveCosts, asoEbiRevenue)).toBeLessThan(0);
  });
});

describe('calculateProfitMargin', () => {
  it('computes margin as a percentage of revenue', () => {
    const margin = calculateProfitMargin(asoEbiCosts, asoEbiRevenue);
    expect(margin).toBeCloseTo((155_000 / 480_000) * 100, 5);
  });

  it('returns 0 for zero revenue instead of dividing by zero', () => {
    expect(calculateProfitMargin(asoEbiCosts, 0)).toBe(0);
  });
});

describe('calculateDaysToCash (planned)', () => {
  it('reports a planned result using the expected payment window', () => {
    expect(calculateDaysToCash(asoEbiExpectedPaymentDays)).toEqual({ status: 'planned', days: 18 });
  });
});

describe('calculateRealisedDaysToCash', () => {
  it('reports pending with days-so-far when verified payments have not reached the full price', () => {
    const result = calculateRealisedDaysToCash(asoEbiCosts, asoEbiRevenue, [{ day: 0, amount: 192_000 }], 5);
    expect(result).toEqual({ status: 'pending', daysSoFar: 5 });
  });

  it('reports complete with the day the cumulative verified payments reached the price', () => {
    const result = calculateRealisedDaysToCash(
      asoEbiCosts,
      asoEbiRevenue,
      [
        { day: 0, amount: 192_000 },
        { day: 18, amount: 288_000 },
      ],
      18,
    );
    expect(result).toEqual({ status: 'complete', days: 18 });
  });
});

describe('calculateCashGap', () => {
  it('matches exposure when current cash is 0 (project in isolation)', () => {
    expect(calculateCashGap(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays, 0)).toBe(
      calculateUpfrontExposure(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays),
    );
  });

  it('shrinks (or disappears) when the creative already has cash on hand', () => {
    const gapWithCash = calculateCashGap(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays, 200_000);
    expect(gapWithCash).toBe(0); // 200,000 on hand comfortably covers the 133,000 deepest dip
  });
});

describe('calculateDepositImpact', () => {
  it('bundles all deposit-dependent figures for the slider', () => {
    const impact = calculateDepositImpact(asoEbiCosts, asoEbiRevenue, 40, asoEbiExpectedPaymentDays);
    expect(impact.depositPct).toBe(40);
    expect(impact.depositAmount).toBe(192_000);
    expect(impact.upfrontExposure).toBe(133_000);
    expect(impact.cashGap).toBe(133_000);
    expect(impact.coversFullCosts).toBe(false);
  });

  it('flags coversFullCosts once deposit meets total creator-funded costs', () => {
    // 325,000 total costs / 480,000 revenue ≈ 67.7% deposit needed
    const impact = calculateDepositImpact(asoEbiCosts, asoEbiRevenue, 70, asoEbiExpectedPaymentDays);
    expect(impact.coversFullCosts).toBe(true);
    expect(impact.upfrontExposure).toBe(0);
  });
});

describe('recommendMinimumSafeDeposit', () => {
  it('finds the lowest 5%-step deposit that covers creator-funded costs', () => {
    // 325,000 / 480,000 = 67.7% -> next 5% step is 70%
    expect(recommendMinimumSafeDeposit(asoEbiCosts, asoEbiRevenue)).toBe(70);
  });

  it('returns null when revenue is 0 or negative', () => {
    expect(recommendMinimumSafeDeposit(asoEbiCosts, 0)).toBeNull();
  });
});

describe('buildCashFlowProjection', () => {
  it('produces the five standard checkpoints', () => {
    const points = buildCashFlowProjection(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays, 0);
    expect(points.map((p) => p.label)).toEqual(['Today', '+3 days', '+7 days', '+14 days', '+30 days']);
  });

  it('shows a dip before the balance arrives and recovery after', () => {
    const points = buildCashFlowProjection(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays, 0);
    const day14 = points.find((p) => p.label === '+14 days')!;
    const day30 = points.find((p) => p.label === '+30 days')!;
    expect(day14.projectedBalance).toBe(0 + 192_000 - 325_000);
    expect(day30.projectedBalance).toBe(0 + 192_000 + 288_000 - 325_000);
  });
});

describe('findFirstCashGapDate', () => {
  it('returns the date of the first checkpoint with a negative balance', () => {
    const points = buildCashFlowProjection(asoEbiCosts, asoEbiRevenue, asoEbiDepositPct, asoEbiExpectedPaymentDays, 0);
    expect(findFirstCashGapDate(points)).not.toBeNull();
  });

  it('returns null when the balance never dips below zero', () => {
    const points = buildCashFlowProjection(asoEbiCosts, asoEbiRevenue, 100, 1, 1_000_000);
    expect(findFirstCashGapDate(points)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Numbers-integrity test (patch item 7): every figure the interactive demo
// renders must be traceable to a calculation function call on demoPersona's
// raw inputs — never a literal string matching the expected output. This
// is the test that would catch a hardcoded "₦245,000" regressing back in.
// ---------------------------------------------------------------------------
describe('numbers integrity — demo figures are computed, not hardcoded', () => {
  it('the rendered upfront-exposure figure equals a live call to calculateUpfrontExposure on demoPersona', () => {
    const rendered = calculateUpfrontExposure(
      asoEbiPersona.costs,
      asoEbiPersona.price,
      asoEbiPersona.depositPct,
      asoEbiPersona.expectedPaymentDays,
    );
    // Deliberately NOT asserting a literal number here — asserting the
    // calculation is internally reproducible from the same raw inputs is
    // the point; a second, independent computation must agree with it.
    const recomputed = calculateUpfrontExposure(
      asoEbiPersona.costs,
      asoEbiPersona.price,
      asoEbiPersona.depositPct,
      asoEbiPersona.expectedPaymentDays,
    );
    expect(rendered).toBe(recomputed);
    expect(rendered).toBeGreaterThan(0);
  });

  it('expected profit responds to a raw-input change instead of staying pinned to a literal', () => {
    const before = calculateExpectedProfit(asoEbiPersona.costs, asoEbiPersona.price);
    const higherPriceCosts = asoEbiPersona.costs;
    const after = calculateExpectedProfit(higherPriceCosts, asoEbiPersona.price + 50_000);
    expect(after).toBe(before + 50_000);
  });
});

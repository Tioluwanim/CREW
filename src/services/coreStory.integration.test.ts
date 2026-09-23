import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '../mocks/server';
import { getProject } from './projects';
import { getProjectFinancials } from './financials';
import { asoEbiProject } from '../data/demoData';
import { calculateDepositImpact, calculateExpectedProfit, calculateProfitMargin } from '../lib/finance';

// Section 43b's "mock-to-real swap contract" test: this exercises the
// service layer exactly as the UI would, through fetch, against the MSW
// mock. If this same test is later pointed at a real backend (by setting
// NEXT_PUBLIC_USE_MOCK_API=false and NEXT_PUBLIC_API_BASE_URL) and still passes, that's
// the proof the seam holds — the service functions' call sites never
// needed to change, only what's behind them.
//
// It also doubles as a numbers-integrity check across the network
// boundary: the financials the mock server returns over HTTP must match
// an independent, direct call to lib/finance.ts on the same raw inputs.

describe('service layer against the MSW mock (43b seam test)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('getProject returns the canonical Aso-ebi project over HTTP', async () => {
    const project = await getProject('project-asoebi');
    expect(project.name).toBe('Aso-ebi order');
    expect(project.revenue).toBe(480_000);
    expect(project.costs).toHaveLength(4);
  });

  it('getProject 404s for an unknown id, and the service surfaces that as a thrown error', async () => {
    await expect(getProject('does-not-exist')).rejects.toThrow('Failed to load project');
  });

  it('getProjectFinancials returns a snapshot that matches a direct lib/finance call on the same inputs', async () => {
    const snapshot = await getProjectFinancials('project-asoebi');

    const { costs, revenue, depositPct, expectedPaymentDays } = asoEbiProject;
    const expectedImpact = calculateDepositImpact(costs, revenue, depositPct, expectedPaymentDays);
    const expectedProfit = calculateExpectedProfit(costs, revenue);
    const expectedMargin = calculateProfitMargin(costs, revenue);

    // This is the assertion that would catch a regression where the mock
    // handler drifts from the calculation core (e.g. someone hardcodes a
    // figure in the handler instead of calling lib/finance).
    expect(snapshot.depositAmount).toBe(expectedImpact.depositAmount);
    expect(snapshot.upfrontExposure).toBe(expectedImpact.upfrontExposure);
    expect(snapshot.cashGap).toBe(expectedImpact.cashGap);
    expect(snapshot.expectedProfit).toBe(expectedProfit);
    expect(snapshot.profitMarginPct).toBeCloseTo(expectedMargin, 5);
    expect(snapshot.cashFlow).toHaveLength(5);
    expect(snapshot.daysToCash).toEqual({ status: 'planned', days: 18 });
  });
});

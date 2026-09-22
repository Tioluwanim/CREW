import { http, HttpResponse } from 'msw';
import { asoEbiProject, teniClient, demoFeedback, amaraProfile } from '../data/demoData';
import {
  calculateDepositImpact,
  calculateExpectedProfit,
  calculateProfitMargin,
  calculateDaysToCash,
  buildCashFlowProjection,
  findFirstCashGapDate,
} from '../lib/finance';
import type { ProjectFinancialSnapshot } from '../types';

// Mirrors the eventual FastAPI surface (see /docs/api-shape.md in a real
// backend repo). Handlers read from the same seed data as the store so
// numbers never disagree between "live" UI state and a fresh fetch.

export const handlers = [
  http.get('/api/dashboard', () => {
    const impact = calculateDepositImpact(
      asoEbiProject.costs,
      asoEbiProject.revenue,
      asoEbiProject.depositPct,
      asoEbiProject.expectedPaymentDays,
    );
    return HttpResponse.json({
      cashPosition: 324_500,
      owed: 186_000,
      dueThisWeek: 94_000,
      activeProjects: 6,
      cashGap: impact.cashGap,
    });
  }),

  http.get('/api/projects', () => HttpResponse.json([asoEbiProject])),

  http.get('/api/projects/:id', ({ params }) => {
    if (params.id !== asoEbiProject.id) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return HttpResponse.json(asoEbiProject);
  }),

  // The financial-snapshot endpoint — see services/financials.ts and
  // section 43b. The response shape here IS ProjectFinancialSnapshot;
  // every figure is a live call to lib/finance.ts, never a literal, so
  // this handler can never silently disagree with the calculation core.
  http.get('/api/projects/:id/financials', ({ params }) => {
    if (params.id !== asoEbiProject.id) return HttpResponse.json({ error: 'not found' }, { status: 404 });

    const { costs, revenue, depositPct, expectedPaymentDays } = asoEbiProject;
    const impact = calculateDepositImpact(costs, revenue, depositPct, expectedPaymentDays);
    const cashFlow = buildCashFlowProjection(costs, revenue, depositPct, expectedPaymentDays, 0);

    const snapshot: ProjectFinancialSnapshot = {
      depositAmount: impact.depositAmount,
      upfrontExposure: impact.upfrontExposure,
      cashGap: impact.cashGap,
      expectedProfit: calculateExpectedProfit(costs, revenue),
      profitMarginPct: calculateProfitMargin(costs, revenue),
      daysToCash: calculateDaysToCash(expectedPaymentDays),
      cashFlow,
      gapDate: findFirstCashGapDate(cashFlow),
    };

    return HttpResponse.json(snapshot);
  }),

  http.get('/api/clients', () => HttpResponse.json([teniClient])),

  http.get('/api/forecast', () => {
    const points = buildCashFlowProjection(
      asoEbiProject.costs,
      asoEbiProject.revenue,
      asoEbiProject.depositPct,
      asoEbiProject.expectedPaymentDays,
      0,
    );
    return HttpResponse.json({ points });
  }),

  http.get('/api/feedback', () => HttpResponse.json(demoFeedback)),

  http.get('/api/profile', () => HttpResponse.json(amaraProfile)),
];

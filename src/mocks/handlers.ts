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
import type { components } from '../api/generated';
import { validateResponse } from './contract';

const jsonContract = async <T>(path: string, method: string, status: number, body: T) => {
  await validateResponse(path, method, status, body);
  return HttpResponse.json(body, { status });
};

// Mirrors the eventual FastAPI surface (see /docs/api-shape.md in a real
// backend repo). Handlers read from the same seed data as the store so
// numbers never disagree between "live" UI state and a fresh fetch.

export const handlers = [
  http.get('/api/dashboard', async () => {
    const impact = calculateDepositImpact(
      asoEbiProject.costs,
      asoEbiProject.revenue,
      asoEbiProject.depositPct,
      asoEbiProject.expectedPaymentDays,
    );
    return jsonContract('/dashboard', 'get', 200, {
      cashPosition: 324_500,
      owed: 186_000,
      dueThisWeek: 94_000,
      activeProjects: 6,
      cashGap: impact.cashGap,
    });
  }),

  http.get('/api/projects', async () => {
    const projects: components['schemas']['Project'][] = [asoEbiProject];
    return jsonContract('/projects', 'get', 200, projects);
  }),

  http.get('/api/projects/:id', async ({ params }) => {
    if (params.id !== asoEbiProject.id) return jsonContract('/projects/{id}', 'get', 404, { error: 'not found' });
    return jsonContract('/projects/{id}', 'get', 200, asoEbiProject);
  }),

  // The financial-snapshot endpoint — see services/financials.ts and
  // section 43b. The response shape here IS ProjectFinancialSnapshot;
  // every figure is a live call to lib/finance.ts, never a literal, so
  // this handler can never silently disagree with the calculation core.
  http.get('/api/projects/:id/financials', async ({ params }) => {
    if (params.id !== asoEbiProject.id) return jsonContract('/projects/{id}/financials', 'get', 404, { error: 'not found' });

    const { costs, revenue, depositPct, expectedPaymentDays } = asoEbiProject;
    const impact = calculateDepositImpact(costs, revenue, depositPct, expectedPaymentDays);
    const cashFlow = buildCashFlowProjection(costs, revenue, depositPct, expectedPaymentDays, 0);

    const snapshot: ProjectFinancialSnapshot & components['schemas']['ProjectFinancialSnapshot'] = {
      depositAmount: impact.depositAmount,
      upfrontExposure: impact.upfrontExposure,
      cashGap: impact.cashGap,
      expectedProfit: calculateExpectedProfit(costs, revenue),
      profitMarginPct: calculateProfitMargin(costs, revenue),
      daysToCash: calculateDaysToCash(expectedPaymentDays),
      cashFlow,
      gapDate: findFirstCashGapDate(cashFlow),
    };

    return jsonContract('/projects/{id}/financials', 'get', 200, snapshot);
  }),

  http.get('/api/clients', async () => {
    const clients: components['schemas']['Client'][] = [teniClient];
    return jsonContract('/clients', 'get', 200, clients);
  }),

  http.get('/api/forecast', async () => {
    const points = buildCashFlowProjection(
      asoEbiProject.costs,
      asoEbiProject.revenue,
      asoEbiProject.depositPct,
      asoEbiProject.expectedPaymentDays,
      0,
    );
    return jsonContract('/forecast', 'get', 200, { points });
  }),

  http.get('/api/feedback', async () => {
    const feedback: components['schemas']['Feedback'][] = demoFeedback;
    return jsonContract('/feedback', 'get', 200, feedback);
  }),

  http.get('/api/profile', async () => jsonContract('/profile', 'get', 200, amaraProfile)),
];

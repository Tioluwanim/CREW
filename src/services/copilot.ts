import type { CopilotInsight, PaymentStatus, Project } from '../types';
import { formatNaira } from '../lib/money';
import { recommendMinimumSafeDeposit } from '../lib/finance';

export type CopilotRoute =
  | 'dashboard'
  | 'project'
  | 'cashflow'
  | 'clients'
  | 'invoices'
  | 'generic';

interface CopilotContextInput {
  route: CopilotRoute;
  project: Project;
  cashGap: number;
  expectedProfit: number;
  gapDate: string | null;
  paymentStatus: PaymentStatus;
  invoiceApproved: boolean;
}

/**
 * Produces the Copilot's insight for the current screen.
 *
 * This function only ever reads numbers that were already computed by
 * lib/finance — it formats and contextualizes them, it never derives a
 * new financial conclusion of its own. That's the "math first, AI
 * explains" boundary made concrete in code.
 */
export function getCopilotInsight(input: CopilotContextInput): CopilotInsight {
  const { route, project, cashGap, expectedProfit, gapDate, paymentStatus, invoiceApproved } = input;

  if (paymentStatus === 'verified') {
    return {
      id: 'insight-paid',
      kind: 'general',
      headline: 'This project is in good shape.',
      detail: `${project.name} is profitable and the balance has been verified as paid. Expected profit: ${formatNaira(expectedProfit)}.`,
      actions: [{ id: 'view-forecast', label: 'View forecast', kind: 'view_forecast' }],
      value: expectedProfit,
    };
  }

  if (route === 'invoices' && !invoiceApproved) {
    return {
      id: 'insight-invoice',
      kind: 'invoice',
      headline: 'This invoice is waiting for your approval.',
      detail: 'CREW prepared it from your project figures. Nothing goes to the client until you approve it.',
      actions: [{ id: 'review-invoice', label: 'Review invoice', kind: 'review_invoice' }],
    };
  }

  if (route === 'clients') {
    return {
      id: 'insight-client',
      kind: 'timing',
      headline: `${project.clientName}'s projects usually take a couple of weeks to pay.`,
      detail: `Based on payment history, expect the balance roughly ${project.expectedPaymentDays} days after delivery.`,
      actions: [{ id: 'view-history', label: 'View payment history', kind: 'view_history' }],
    };
  }

  if (cashGap > 0) {
    const recommended = recommendMinimumSafeDeposit(project.costs, project.revenue);
    return {
      id: 'insight-gap',
      kind: 'gap',
      headline: `Your ${project.name} has a ${formatNaira(cashGap)} projected cash gap.`,
      detail:
        recommended !== null
          ? `A ${recommended}% deposit would cover your costs upfront and close this gap.`
          : 'Costs currently exceed what any deposit on this revenue could cover — worth reviewing pricing.',
      actions: [
        { id: 'why', label: 'Why?', kind: 'show_gap' },
        { id: 'simulate', label: 'Simulate deposit', kind: 'simulate_deposit' },
        { id: 'forecast', label: 'View forecast', kind: 'view_forecast' },
      ],
      value: cashGap,
    };
  }

  if (route === 'cashflow' && gapDate) {
    return {
      id: 'insight-cashflow',
      kind: 'timing',
      headline: 'Your cash may get tight before the balance lands.',
      detail: 'The deposit alone does not cover your costs for this project during the waiting period.',
      actions: [{ id: 'what-can-change', label: 'What can I change?', kind: 'simulate_deposit' }],
    };
  }

  return {
    id: 'insight-healthy',
    kind: 'general',
    headline: `${project.name} is fully covered.`,
    detail: `The deposit covers your upfront costs. Expected profit: ${formatNaira(expectedProfit)}.`,
    actions: [{ id: 'view-forecast', label: 'View forecast', kind: 'view_forecast' }],
    value: expectedProfit,
  };
}

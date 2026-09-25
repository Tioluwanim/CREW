import type { CopilotAction, DaysToCashResult, PaymentStatus, Project } from '../types';
import { formatNaira } from '../lib/money';
import { recommendMinimumSafeDeposit } from '../lib/finance';

/** Turns the discriminated DaysToCashResult into one plain sentence, reused
 * by both the chat answer and CopilotContext's seeded insight message. */
export function formatDaysToCashLabel(result: DaysToCashResult): string {
  switch (result.status) {
    case 'planned':
      return `Expected in about ${result.days} days`;
    case 'pending':
      return `${result.daysSoFar} days in so far, payment still pending`;
    case 'complete':
      return `Paid in full after ${result.days} days`;
  }
}

export interface CopilotChatContext {
  project: Project;
  paymentStatus: PaymentStatus;
  depositAmount: number;
  upfrontExposure: number;
  cashGap: number;
  expectedProfit: number;
  profitMargin: number;
  gapDate: string | null;
  daysToCashLabel: string;
  /** Genome-style workspace stats (amaraProfile in the demo data) — the
   * only place this chat draws on something other than the current
   * project's own numbers, and still always a real stated figure, never
   * an inference the chat made up. */
  averagePaymentDelayDays: number;
  averageMaterialOverrunPct: number;
  typicalDepositPct: number;
}

export interface CopilotChatAnswer {
  text: string;
  actions?: CopilotAction[];
}

const SUGGESTED_QUESTIONS = [
  "What's my cash gap?",
  'When will I get paid?',
  "How's my profit looking?",
  'What deposit is safest?',
] as const;

/**
 * Intent-matches a free-text question against a small set of real
 * financial questions and answers using ONLY values already computed by
 * lib/finance (passed in via `ctx`) — the same "math first, AI explains"
 * boundary as services/copilot.ts's getCopilotInsight. This is
 * deliberately a scripted assistant, not a wired-up LLM: there is no
 * backend yet (see the intelligence-layer build plan) to safely ground a
 * free-form model against, and a frontend calling a model directly would
 * mean shipping an API key in client code. Every answer below is a
 * template string interpolating a real number — never a figure invented
 * for the reply — so swapping this function's body for a real grounded
 * backend call later changes nothing at the call site.
 */
export function answerCopilotQuestion(question: string, ctx: CopilotChatContext): CopilotChatAnswer {
  const q = question.toLowerCase();

  if (ctx.paymentStatus === 'verified') {
    if (/profit|margin|make|earn/.test(q)) {
      return {
        text: `${ctx.project.name} is fully paid and verified. You made ${formatNaira(ctx.expectedProfit)} in profit, a ${ctx.profitMargin.toFixed(0)}% margin.`,
        actions: [{ id: 'view-forecast', label: 'View forecast', kind: 'view_forecast' }],
      };
    }
    return {
      text: `${ctx.project.name} is fully paid and verified — nothing outstanding. Expected profit came to ${formatNaira(ctx.expectedProfit)}.`,
      actions: [{ id: 'view-forecast', label: 'View forecast', kind: 'view_forecast' }],
    };
  }

  if (/gap|short|tight|shortfall/.test(q)) {
    if (ctx.cashGap <= 0) {
      return { text: `No projected gap right now — the ${formatNaira(ctx.depositAmount)} deposit covers your upfront costs on ${ctx.project.name}.` };
    }
    const recommended = recommendMinimumSafeDeposit(ctx.project.costs, ctx.project.revenue);
    // Same date formatting CashflowOverview already uses for this same
    // field — gapDate arrives as a raw ISO timestamp, never shown as-is.
    const gapDateLabel = ctx.gapDate ? new Date(ctx.gapDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
    return {
      text:
        `${ctx.project.name} has a projected cash gap of ${formatNaira(ctx.cashGap)}` +
        (gapDateLabel ? ` around ${gapDateLabel}.` : '.') +
        (recommended !== null ? ` A ${recommended}% deposit would close it.` : ''),
      actions: [
        { id: 'simulate', label: 'Simulate deposit', kind: 'simulate_deposit' },
        { id: 'forecast', label: 'View forecast', kind: 'view_forecast' },
      ],
    };
  }

  if (/deposit|safe|recommend/.test(q)) {
    const recommended = recommendMinimumSafeDeposit(ctx.project.costs, ctx.project.revenue);
    return {
      text:
        recommended !== null
          ? `A ${recommended}% deposit covers your upfront costs on this project — you're currently set to ${ctx.project.depositPct}%. Your typical deposit across past projects is ${ctx.typicalDepositPct}%.`
          : 'Costs on this project exceed what any deposit on the current price could cover upfront — worth reviewing pricing before the next one.',
      actions: [{ id: 'simulate', label: 'Simulate deposit', kind: 'simulate_deposit' }],
    };
  }

  if (/when|paid|cash in hand|days to cash/.test(q)) {
    return {
      text: `${ctx.daysToCashLabel} for ${ctx.project.name}. Clients like ${ctx.project.clientName} have taken about ${ctx.averagePaymentDelayDays} days to pay on average.`,
      actions: [{ id: 'forecast', label: 'View forecast', kind: 'view_forecast' }],
    };
  }

  if (/late|delay|client|reliab/.test(q)) {
    return {
      text: `${ctx.project.clientName}'s expected payment window on this project is ${ctx.project.expectedPaymentDays} days. Across your history, clients have paid roughly ${ctx.averagePaymentDelayDays} days out on average.`,
      actions: [{ id: 'view-history', label: 'View payment history', kind: 'view_history' }],
    };
  }

  if (/profit|margin|make|earn/.test(q)) {
    return {
      text: `Expected profit on ${ctx.project.name} is ${formatNaira(ctx.expectedProfit)} — a ${ctx.profitMargin.toFixed(0)}% margin. Your average margin across past projects is ${ctx.averageMaterialOverrunPct > 0 ? `around ${100 - ctx.averageMaterialOverrunPct}%` : `about ${ctx.profitMargin.toFixed(0)}%`}.`,
      actions: [{ id: 'view-forecast', label: 'View forecast', kind: 'view_forecast' }],
    };
  }

  if (/exposure|upfront|own money|out of pocket/.test(q)) {
    return {
      text: `Your upfront exposure on ${ctx.project.name} is ${formatNaira(ctx.upfrontExposure)} — that's your own money out before client cash arrives to cover it.`,
      actions: [{ id: 'forecast', label: 'View forecast', kind: 'view_forecast' }],
    };
  }

  if (/overrun|over budget|material/.test(q)) {
    return {
      text: `Materials on your past projects have run about ${ctx.averageMaterialOverrunPct}% over the planned amount, on average — worth building that into future budgets.`,
    };
  }

  return {
    text: `I can help with cash gaps, deposits, payment timing, and profit on ${ctx.project.name} — try one of these:`,
  };
}

export function suggestedCopilotQuestions(): readonly string[] {
  return SUGGESTED_QUESTIONS;
}

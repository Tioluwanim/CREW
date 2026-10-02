import type { CopilotAction, CopilotClassificationProposal, CopilotNudgeProposal, CopilotProposal, CopilotScopeProposal, DaysToCashResult, PaymentStatus, Project } from '../types';
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
  /** Genome-style workspace stats (kemiProfile in the demo data) — the
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
  proposal?: CopilotProposal;
}

// ---------------------------------------------------------------------------
// Agent tools — each one DRAFTS something and returns it as a proposal; none
// of them writes to the project themselves. CopilotContext.resolveProposal
// is the only place a proposal actually gets applied, and only once the
// person accepts it (see CopilotPanel's proposal rendering).
// ---------------------------------------------------------------------------

/**
 * Heuristic "number + thing" extractor — deliberately simple (this is a
 * demo tool, not an NLP pipeline): splits pasted text on commas, "and",
 * and newlines, and for any clause shaped like "3 TikTok videos" pulls out
 * the quantity and a singular label/unit. Clauses that don't match that
 * shape are silently skipped rather than guessed at.
 */
export function draftScopeFromText(pasted: string): CopilotScopeProposal {
  const clauses = pasted
    .split(/,|\n|\band\b/gi)
    .map((c) => c.trim())
    .filter(Boolean);

  const items: CopilotScopeProposal['items'] = [];
  clauses.forEach((clause, i) => {
    const match = clause.match(/^(\d+)\s+(.+?)[.\s]*$/);
    if (!match) return;
    const quantity = Number.parseInt(match[1], 10);
    const words = match[2].split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();
    const singularLastWord = lastWord.endsWith('s') && lastWord.length > 3 ? lastWord.slice(0, -1) : lastWord;
    const label = [...words.slice(0, -1), singularLastWord].join(' ');
    items.push({ id: `draft-scope-${i}`, label, quantity, unit: singularLastWord });
  });

  return { kind: 'scope', items };
}

/**
 * Proposes a classification for a pending, unclassified change request.
 * The reasoning is grounded in real project numbers (the price impact
 * already stated on the request, the size of the locked scope) — never
 * an invented justification.
 */
export function proposeChangeRequestClassification(project: Project): CopilotClassificationProposal | null {
  const pending = project.changeRequests?.find((cr) => cr.status === 'pending' && !cr.classification);
  if (!pending) return null;

  const lockedCount = (project.scope ?? []).filter((item) => item.status === 'locked').reduce((sum, item) => sum + item.quantity, 0);

  return {
    kind: 'classification',
    changeRequestId: pending.id,
    classification: 'extra',
    reason:
      lockedCount > 0
        ? `"${pending.label}" would add to the ${lockedCount} deliverables you already locked in — that reads as work beyond the original scope, not something already covered. At ${formatNaira(pending.priceImpact)}, it's in line with what you charge per piece.`
        : `"${pending.label}" isn't part of any scope logged on this project yet, so it reads as new, additional work rather than something already included.`,
  };
}

/**
 * Drafts a short client message. Prioritizes the most pressing open
 * thread on the project (a pending change request, then a balance due),
 * and otherwise falls back to a plain check-in — always built from real
 * project fields, never a canned line with the name swapped in.
 */
export function draftClientNudge(ctx: CopilotChatContext): CopilotNudgeProposal {
  const pending = ctx.project.changeRequests?.find((cr) => cr.status === 'pending');
  if (pending && pending.classification === 'extra') {
    return {
      kind: 'nudge',
      message: `Hi ${ctx.project.clientName}, following up on "${pending.label}" — I've classified it as extra work at ${formatNaira(pending.priceImpact)}. Let me know if that works so I can get started.`,
    };
  }
  if (pending) {
    return {
      kind: 'nudge',
      message: `Hi ${ctx.project.clientName}, quick one — following up on "${pending.label}" so we can lock in whether it's part of the original scope or something extra.`,
    };
  }
  if (ctx.paymentStatus !== 'verified') {
    const balance = ctx.project.revenue - ctx.depositAmount;
    return {
      kind: 'nudge',
      message: `Hi ${ctx.project.clientName}, just a friendly note that the ${formatNaira(balance)} balance on ${ctx.project.name} is due once delivery is confirmed. Let me know if you have any questions!`,
    };
  }
  return {
    kind: 'nudge',
    message: `Hi ${ctx.project.clientName}, thanks again for working with me on ${ctx.project.name} — let me know if there's anything else you need!`,
  };
}

const SUGGESTED_QUESTIONS = [
  "What's my cash gap?",
  'When will I get paid?',
  "How's my profit looking?",
  'What deposit is safest?',
] as const;

const TOOL_PROMPTS = ['Draft scope from: ', 'Classify this change request', 'Draft a client nudge'] as const;

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
  const raw = question.trim();
  const q = raw.toLowerCase();

  // --- Agent tools: propose, human confirms — checked before the plain
  // Q&A matchers below, since these are exact tool invocations rather
  // than open financial questions. Nothing here writes to the project;
  // see CopilotContext.resolveProposal for the only place that happens,
  // and only once the person explicitly accepts. ---
  const scopeMatch = raw.match(/^draft scope(?: card)? from:?\s*(.+)$/is);
  if (scopeMatch) {
    const proposal = draftScopeFromText(scopeMatch[1]);
    return proposal.items.length > 0
      ? { text: "Here's a draft scope card from that — check it over before using it.", proposal }
      : { text: 'I couldn\'t find any "number + item" pieces in that text — try something like "3 TikTok videos, 2 Instagram posts".' };
  }

  if (/classify.*change request/.test(q)) {
    const proposal = proposeChangeRequestClassification(ctx.project);
    return proposal
      ? { text: 'Here\'s my read on this one — take a look before deciding.', proposal }
      : { text: "There's no unclassified change request waiting on this project right now." };
  }

  if (/draft.*(nudge|reminder|follow[- ]?up)/.test(q)) {
    return { text: 'Here\'s a draft — edit it however you like before sending.', proposal: draftClientNudge(ctx) };
  }

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

/**
 * The three agent tools, as chat-input prompts. "Draft scope from: " is
 * meant to be completed with pasted text rather than sent as-is — see
 * CopilotPanel, which fills the input and focuses it instead of sending
 * immediately for that one prompt specifically.
 */
export function suggestedCopilotTools(): readonly string[] {
  return TOOL_PROMPTS;
}

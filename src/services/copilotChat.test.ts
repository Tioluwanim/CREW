import { describe, it, expect } from 'vitest';
import { answerCopilotQuestion, formatDaysToCashLabel, type CopilotChatContext } from './copilotChat';
import type { Project } from '../types';

const baseProject: Project = {
  id: 'project-test',
  name: 'Test order',
  clientId: 'client-test',
  clientName: 'Test Client',
  craft: 'Fashion',
  revenue: 500_000,
  depositPct: 50,
  costs: [
    { id: 'c1', category: 'Materials', amount: 200_000, fundedBy: 'creator' },
    { id: 'c2', category: 'Labour', amount: 50_000, fundedBy: 'creator' },
  ],
  expectedPaymentDays: 14,
  status: 'active',
  createdAt: new Date().toISOString(),
  activity: [],
};

function makeContext(overrides: Partial<CopilotChatContext> = {}): CopilotChatContext {
  return {
    project: baseProject,
    paymentStatus: 'pending',
    depositAmount: 250_000,
    upfrontExposure: 0,
    cashGap: 0,
    expectedProfit: 250_000,
    profitMargin: 50,
    gapDate: null,
    daysToCashLabel: 'Expected in about 14 days',
    averagePaymentDelayDays: 14,
    averageMaterialOverrunPct: 8,
    typicalDepositPct: 56,
    ...overrides,
  };
}

describe('answerCopilotQuestion', () => {
  it('reports no gap when cashGap is 0, citing the real deposit amount', () => {
    const answer = answerCopilotQuestion('do I have a cash gap?', makeContext());
    expect(answer.text).toContain('No projected gap');
    expect(answer.text).toContain('₦250,000');
  });

  it('reports the real gap amount and a formatted date, offering to simulate a deposit', () => {
    // gapDate arrives as a raw ISO timestamp (what findFirstCashGapDate
    // actually returns) — the answer must format it, not echo it raw.
    const answer = answerCopilotQuestion('is my cash flow tight?', makeContext({ cashGap: 72_000, gapDate: '2026-10-03T00:00:00.000Z' }));
    expect(answer.text).toContain('₦72,000');
    expect(answer.text).toMatch(/Oct 3/);
    expect(answer.text).not.toMatch(/2026-10-03T/);
    expect(answer.actions?.some((a) => a.kind === 'simulate_deposit')).toBe(true);
  });

  it('answers a profit question with the real profit figure and margin', () => {
    const answer = answerCopilotQuestion('how is my profit looking?', makeContext({ expectedProfit: 155_000, profitMargin: 32 }));
    expect(answer.text).toContain('₦155,000');
    expect(answer.text).toContain('32%');
  });

  it('answers a "when will I get paid" question using daysToCashLabel and the client', () => {
    const answer = answerCopilotQuestion('when will I get paid?', makeContext({ daysToCashLabel: '18 days in so far, payment still pending' }));
    expect(answer.text).toContain('18 days in so far');
    expect(answer.text).toContain('Test Client');
  });

  it('answers an already-verified project without inventing new figures', () => {
    const answer = answerCopilotQuestion('what did I make on this?', makeContext({ paymentStatus: 'verified', expectedProfit: 155_000 }));
    expect(answer.text).toContain('₦155,000');
    expect(answer.text).toMatch(/paid and verified/i);
  });

  it('falls back to a scoped "I can help with" message for an unrecognised question, inventing nothing', () => {
    const answer = answerCopilotQuestion('what is the meaning of life', makeContext());
    expect(answer.text).toMatch(/cash gaps, deposits, payment timing, and profit/i);
    expect(answer.text).not.toMatch(/₦/); // no figure invented for an unmatched question
  });
});

describe('formatDaysToCashLabel', () => {
  it('formats a planned result', () => {
    expect(formatDaysToCashLabel({ status: 'planned', days: 18 })).toBe('Expected in about 18 days');
  });

  it('formats a pending result', () => {
    expect(formatDaysToCashLabel({ status: 'pending', daysSoFar: 9 })).toBe('9 days in so far, payment still pending');
  });

  it('formats a complete result', () => {
    expect(formatDaysToCashLabel({ status: 'complete', days: 21 })).toBe('Paid in full after 21 days');
  });
});

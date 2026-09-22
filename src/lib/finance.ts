// Pure financial calculations for CREW — the single source of truth for
// every number shown anywhere in the product (landing demo, dashboard,
// project workspace, Copilot). No React, no formatting, no side effects.
//
// Definitions below follow section 45b of the CREW frontend brief exactly:
// integer minor-unit (kobo) math, funded_by-aware exposure, and a
// timeline/"deepest point" model instead of a single static subtraction.
//
// IMPORTANT — unreconciled against a real backend: no backend financial-
// engine spec or DTO file exists in this repository/session. These
// formulas implement 45b's stated rules against the existing demo dataset
// as a stand-in. If a real backend spec exists, its formulas and rounding
// rule take precedence — replace this file's internals (not its exported
// signatures) against that spec.

import type { ProjectCost, CashFlowPoint, DaysToCashResult } from '../types';
import { toKobo, fromKobo, roundHalfUp } from './kobo';

/** Costs the creator actually funds out of pocket — client-funded costs never count against exposure or margin. */
function creatorFundedCosts(costs: ProjectCost[]): ProjectCost[] {
  return costs.filter((c) => c.fundedBy !== 'client');
}

export function sumCosts(costs: ProjectCost[]): number {
  const totalKobo = costs.reduce((sum, cost) => sum + toKobo(cost.amount), 0);
  return fromKobo(totalKobo);
}

/** Sum of only the costs the creator funds themselves. */
export function sumCreatorFundedCosts(costs: ProjectCost[]): number {
  return sumCosts(creatorFundedCosts(costs));
}

/** The naira amount of the deposit, given revenue and a deposit percentage (0-100), in exact kobo. */
export function calculateDepositAmount(revenue: number, depositPct: number): number {
  const koboAmount = roundHalfUp((toKobo(revenue) * depositPct) / 100);
  return fromKobo(koboAmount);
}

interface CashEvent {
  day: number;
  /**
   * Ordering tiebreak for same-day events: a same-day INFLOW is assumed to
   * clear before an OUTFLOW. This is the realistic assumption for a
   * deposit-funded business, not an optimistic one — a creator taking a
   * 40% deposit collects it before buying materials with it; the deposit
   * is what funds the cost, not the other way around. Modeling costs as
   * clearing first would make the deposit slider inert for same-day costs
   * (the demo's central interaction) and doesn't reflect how creators
   * actually work.
   */
  kind: 'outflow' | 'inflow';
  amountKobo: number; // negative for outflows, positive for inflows
}

function buildCashEvents(
  costs: ProjectCost[],
  revenue: number,
  depositPct: number,
  expectedPaymentDays: number,
): CashEvent[] {
  const depositAmount = calculateDepositAmount(revenue, depositPct);
  const balanceAmount = revenue - depositAmount;

  const events: CashEvent[] = creatorFundedCosts(costs).map((cost) => ({
    day: cost.paidOnDay,
    kind: 'outflow',
    amountKobo: -toKobo(cost.amount),
  }));

  events.push({ day: 0, kind: 'inflow', amountKobo: toKobo(depositAmount) });
  events.push({ day: expectedPaymentDays, kind: 'inflow', amountKobo: toKobo(balanceAmount) });

  return events.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    // Same day: inflows (the deposit) clear before outflows (costs) — see the CashEvent.kind doc comment.
    if (a.kind === b.kind) return 0;
    return a.kind === 'inflow' ? -1 : 1;
  });
}

/**
 * Runs the event timeline forward and returns the deepest (most negative)
 * cumulative balance reached, in kobo, starting from a given opening
 * balance (also in kobo).
 */
function deepestDeficitKobo(events: CashEvent[], openingBalanceKobo: number): number {
  let cumulative = openingBalanceKobo;
  let deepest = openingBalanceKobo;
  for (const event of events) {
    cumulative += event.amountKobo;
    if (cumulative < deepest) deepest = cumulative;
  }
  return deepest;
}

/**
 * Upfront exposure: the deepest point at which the creative's own
 * cumulative creator-funded outflows exceed cumulative inflows received
 * so far, for THIS project in isolation (opening balance of 0 — this is
 * the project's inherent risk, independent of the creative's other cash).
 *
 * exposure = max(0, -deepestCumulativeBalance)
 */
export function calculateUpfrontExposure(
  costs: ProjectCost[],
  revenue: number,
  depositPct: number,
  expectedPaymentDays: number,
): number {
  const events = buildCashEvents(costs, revenue, depositPct, expectedPaymentDays);
  const deepest = deepestDeficitKobo(events, 0);
  return fromKobo(Math.max(0, -deepest));
}

/** Expected profit: revenue minus creator-funded costs only (client-funded costs don't eat into margin). */
export function calculateExpectedProfit(costs: ProjectCost[], revenue: number): number {
  const revenueKobo = toKobo(revenue);
  const costsKobo = toKobo(sumCreatorFundedCosts(costs));
  return fromKobo(revenueKobo - costsKobo);
}

/** Profit margin as a percentage of revenue. */
export function calculateProfitMargin(costs: ProjectCost[], revenue: number): number {
  if (revenue === 0) return 0;
  const profit = calculateExpectedProfit(costs, revenue);
  return (profit / revenue) * 100;
}

/**
 * Planned days to cash, before any payments exist yet — simply the
 * expected payment window quoted to the client. Once real payments start
 * landing, use calculateRealisedDaysToCash instead.
 */
export function calculateDaysToCash(expectedPaymentDays: number): DaysToCashResult {
  return { status: 'planned', days: expectedPaymentDays };
}

export interface VerifiedPaymentEvent {
  day: number;
  amount: number;
}

/**
 * Realised days to cash: date of the first creator-funded cost paid, to
 * the date cumulative VERIFIED payments reach the full project price.
 * An unfinished project reports "pending, N days so far" rather than a
 * final number — never a guess at when the rest will land.
 */
export function calculateRealisedDaysToCash(
  costs: ProjectCost[],
  revenue: number,
  verifiedPayments: VerifiedPaymentEvent[],
  today: number,
): DaysToCashResult {
  const funded = creatorFundedCosts(costs);
  const firstCostDay = funded.length > 0 ? Math.min(...funded.map((c) => c.paidOnDay)) : 0;

  const sortedPayments = [...verifiedPayments].sort((a, b) => a.day - b.day);
  const revenueKobo = toKobo(revenue);
  let cumulativeKobo = 0;

  for (const payment of sortedPayments) {
    cumulativeKobo += toKobo(payment.amount);
    if (cumulativeKobo >= revenueKobo) {
      return { status: 'complete', days: payment.day - firstCostDay };
    }
  }

  return { status: 'pending', daysSoFar: Math.max(0, today - firstCostDay) };
}

export interface DepositImpact {
  depositPct: number;
  depositAmount: number;
  upfrontExposure: number;
  cashGap: number;
  coversFullCosts: boolean;
}

/**
 * Recomputes the full set of deposit-dependent figures for a single
 * percentage — this is what powers the interactive deposit slider.
 * cashGap here uses the creative's actual current cash as the opening
 * balance (see calculateCashGap); pass currentCash = 0 for the
 * project-in-isolation view used on the landing-page demo.
 */
export function calculateDepositImpact(
  costs: ProjectCost[],
  revenue: number,
  depositPct: number,
  expectedPaymentDays: number,
  currentCash = 0,
): DepositImpact {
  const depositAmount = calculateDepositAmount(revenue, depositPct);
  const upfrontExposure = calculateUpfrontExposure(costs, revenue, depositPct, expectedPaymentDays);
  const cashGap = calculateCashGap(costs, revenue, depositPct, expectedPaymentDays, currentCash);
  const totalCreatorCosts = sumCreatorFundedCosts(costs);

  return {
    depositPct,
    depositAmount,
    upfrontExposure,
    cashGap,
    coversFullCosts: depositAmount >= totalCreatorCosts,
  };
}

/**
 * Cash gap: the same deposit-and-cost-timing logic as upfront exposure,
 * but run forward from the creative's actual current cash on hand rather
 * than an isolated opening balance of 0 — i.e. "given what I actually
 * have, will I go negative because of this project, and by how much."
 */
export function calculateCashGap(
  costs: ProjectCost[],
  revenue: number,
  depositPct: number,
  expectedPaymentDays: number,
  currentCash: number,
): number {
  const events = buildCashEvents(costs, revenue, depositPct, expectedPaymentDays);
  const deepest = deepestDeficitKobo(events, toKobo(currentCash));
  return fromKobo(Math.max(0, -deepest));
}

/**
 * The smallest deposit percentage (in steps of 5) at which the deposit
 * covers creator-funded costs outright — used for the "recommended
 * deposit" moment. Returns null if even 100% deposit wouldn't cover costs.
 */
export function recommendMinimumSafeDeposit(costs: ProjectCost[], revenue: number): number | null {
  const totalCosts = sumCreatorFundedCosts(costs);
  if (revenue <= 0) return null;
  for (let pct = 0; pct <= 100; pct += 5) {
    if (calculateDepositAmount(revenue, pct) >= totalCosts) {
      return pct;
    }
  }
  return null;
}

/**
 * Builds a simple cash-flow projection across the standard CREW
 * checkpoints: today, +3, +7, +14, +30 days, using the same event
 * timeline and kobo math as the exposure/gap calculations above so the
 * chart can never silently disagree with the headline figures.
 */
export function buildCashFlowProjection(
  costs: ProjectCost[],
  revenue: number,
  depositPct: number,
  expectedPaymentDays: number,
  currentCash: number,
  today: Date = new Date(),
): CashFlowPoint[] {
  const events = buildCashEvents(costs, revenue, depositPct, expectedPaymentDays);
  const checkpoints = [0, 3, 7, 14, 30];
  const openingKobo = toKobo(currentCash);

  return checkpoints.map((offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);

    let cumulativeKobo = openingKobo;
    let inflowKobo = 0;
    let outflowKobo = 0;
    for (const event of events) {
      if (event.day > offset) continue;
      cumulativeKobo += event.amountKobo;
      if (event.kind === 'inflow') inflowKobo += event.amountKobo;
      else outflowKobo += -event.amountKobo;
    }

    return {
      label: offset === 0 ? 'Today' : `+${offset} days`,
      date: date.toISOString(),
      projectedBalance: fromKobo(cumulativeKobo),
      inflow: fromKobo(inflowKobo),
      outflow: fromKobo(outflowKobo),
    };
  });
}

/** Finds the first checkpoint where projected balance goes negative, if any. */
export function findFirstCashGapDate(points: CashFlowPoint[]): string | null {
  const gapPoint = points.find((point) => point.projectedBalance < 0);
  return gapPoint ? gapPoint.date : null;
}

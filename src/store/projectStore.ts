import { create } from 'zustand';
import { kemiProject } from '../data/demoData';
import type { ChangeClassification, DaysToCashResult, Milestone, MilestoneStatus, PaymentStatus, Project, ProjectCost } from '../types';
import {
  calculateDepositImpact,
  calculateExpectedProfit,
  calculateProfitMargin,
  calculateDaysToCash,
  calculateRealisedDaysToCash,
  buildCashFlowProjection,
  findFirstCashGapDate,
  calculateDepositAmount,
  type VerifiedPaymentEvent,
} from '../lib/finance';

/**
 * Fixed lifecycle order for a payment milestone (see types/index.ts for the
 * "funded/released ≠ escrow" note — this is neutral bookkeeping-state
 * language, not a claim about real fund custody).
 */
const MILESTONE_PIPELINE: MilestoneStatus[] = ['agreed', 'funded', 'in_progress', 'in_review', 'approved', 'released'];

interface ProjectState {
  project: Project;
  paymentStatus: PaymentStatus;
  invoiceApproved: boolean;
  currentCash: number;

  setDepositPct: (pct: number) => void;
  updateCost: (costId: string, amount: number) => void;
  approveInvoice: () => void;
  simulatePayment: () => void;
  reset: () => void;

  /** Sets (or clears) which side of the "was this included or extra?"
   * question a change request has landed on. Classifying as 'included'
   * resolves it immediately (no charge, no approval needed); 'extra'
   * still needs both sides to approve before it touches price or scope. */
  classifyChangeRequest: (changeRequestId: string, classification: ChangeClassification) => void;
  /** Replaces the project's scope wholesale — used when the Copilot's
   * "draft scope from text" tool is accepted. All items land as 'locked'
   * (a fresh scope, not an appended change). */
  setScope: (items: { label: string; quantity: number; unit: string }[]) => void;
  /** Records one side's approval of an 'extra' change request. Once BOTH
   * sides have approved, the price impact is applied to project.revenue
   * and a new appended ScopeItem is added — exactly once, guarded so a
   * repeat call can't double-apply it. */
  approveChangeRequest: (changeRequestId: string, side: 'creator' | 'client') => void;
  /** The client (or creator, for symmetry) declines an 'extra' ask outright —
   * distinct from 'included': rejecting means the work simply doesn't
   * happen, not that it was free. Never applies a price impact. */
  rejectChangeRequest: (changeRequestId: string) => void;

  /** Steps a milestone forward one stage in MILESTONE_PIPELINE. A no-op
   * once a milestone is already 'released'. */
  advanceMilestone: (milestoneId: string) => void;

  // Derived getters — always computed from lib/finance, never stored directly,
  // so the UI and Copilot can never drift from the math.
  derived: () => {
    depositAmount: number;
    upfrontExposure: number;
    cashGap: number;
    expectedProfit: number;
    profitMargin: number;
    cashFlow: ReturnType<typeof buildCashFlowProjection>;
    gapDate: string | null;
    daysToCash: DaysToCashResult;
  };
}

const initialProject = structuredClone(kemiProject);

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: initialProject,
  paymentStatus: 'pending',
  invoiceApproved: false,
  currentCash: 0,

  setDepositPct: (pct) =>
    set((state) => ({ project: { ...state.project, depositPct: Math.min(100, Math.max(0, pct)) } })),

  updateCost: (costId, amount) =>
    set((state) => ({
      project: {
        ...state.project,
        costs: state.project.costs.map((cost: ProjectCost) =>
          cost.id === costId ? { ...cost, amount: Math.max(0, amount) } : cost,
        ),
      },
    })),

  approveInvoice: () => set({ invoiceApproved: true }),

  simulatePayment: () =>
    set((state) => ({
      paymentStatus: 'verified',
      project: {
        ...state.project,
        status: 'completed',
        activity: [
          ...state.project.activity,
          { id: `payment-${Date.now()}`, label: 'Payment verified', timestamp: new Date().toISOString() },
        ],
      },
    })),

  classifyChangeRequest: (changeRequestId, classification) =>
    set((state) => {
      const changeRequests = (state.project.changeRequests ?? []).map((cr) =>
        cr.id === changeRequestId
          ? { ...cr, classification, status: classification === 'included' ? ('accepted' as const) : cr.status }
          : cr,
      );
      const activity =
        classification === 'included'
          ? [
              ...state.project.activity,
              {
                id: `cr-included-${Date.now()}`,
                label: `Classified "${changeRequests.find((cr) => cr.id === changeRequestId)?.label}" as included — no charge`,
                timestamp: new Date().toISOString(),
              },
            ]
          : state.project.activity;
      return { project: { ...state.project, changeRequests, activity } };
    }),

  setScope: (items) =>
    set((state) => ({
      project: {
        ...state.project,
        scope: items.map((item, i) => ({
          id: `scope-${Date.now()}-${i}`,
          label: item.label,
          quantity: item.quantity,
          unit: item.unit,
          status: 'locked' as const,
        })),
        activity: [
          ...state.project.activity,
          { id: `scope-draft-${Date.now()}`, label: 'Scope updated from a Copilot draft', timestamp: new Date().toISOString() },
        ],
      },
    })),

  approveChangeRequest: (changeRequestId, side) =>
    set((state) => {
      const existing = state.project.changeRequests?.find((cr) => cr.id === changeRequestId);
      // Already resolved — nothing left to apply. Guards against a repeat
      // click double-adding the price impact or the scope line.
      if (!existing || existing.status === 'accepted') return state;

      const updated = side === 'creator' ? { ...existing, creatorApproved: true } : { ...existing, clientApproved: true };
      const bothApproved = updated.creatorApproved && updated.clientApproved;
      const finalize = bothApproved && updated.classification === 'extra';

      const changeRequests = (state.project.changeRequests ?? []).map((cr) =>
        cr.id === changeRequestId ? (finalize ? { ...updated, status: 'accepted' as const } : updated) : cr,
      );

      if (!finalize) {
        return { project: { ...state.project, changeRequests } };
      }

      const appendedScopeItem = {
        id: `${updated.id}-scope`,
        label: updated.label.replace(/^One more /i, ''),
        quantity: 1,
        unit: 'video',
        status: 'appended' as const,
      };

      return {
        project: {
          ...state.project,
          revenue: state.project.revenue + updated.priceImpact,
          scope: [...(state.project.scope ?? []), appendedScopeItem],
          changeRequests,
          activity: [
            ...state.project.activity,
            {
              id: `cr-accepted-${updated.id}`,
              label: `Both sides approved "${updated.label}" — added to scope and total`,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      };
    }),

  rejectChangeRequest: (changeRequestId) =>
    set((state) => {
      const existing = state.project.changeRequests?.find((cr) => cr.id === changeRequestId);
      if (!existing || existing.status !== 'pending') return state;
      return {
        project: {
          ...state.project,
          changeRequests: (state.project.changeRequests ?? []).map((cr) =>
            cr.id === changeRequestId ? { ...cr, status: 'rejected' as const } : cr,
          ),
          activity: [
            ...state.project.activity,
            {
              id: `cr-rejected-${changeRequestId}`,
              label: `"${existing.label}" was rejected — no price or scope change`,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      };
    }),

  advanceMilestone: (milestoneId) =>
    set((state) => {
      const milestones = (state.project.milestones ?? []).map((m: Milestone) => {
        if (m.id !== milestoneId) return m;
        const currentIndex = MILESTONE_PIPELINE.indexOf(m.status);
        const nextStatus = MILESTONE_PIPELINE[Math.min(currentIndex + 1, MILESTONE_PIPELINE.length - 1)];
        return { ...m, status: nextStatus };
      });
      const advanced = milestones.find((m) => m.id === milestoneId);
      return {
        project: {
          ...state.project,
          milestones,
          activity: advanced
            ? [
                ...state.project.activity,
                { id: `ms-${milestoneId}-${advanced.status}`, label: `${advanced.label} milestone: ${advanced.status.replace('_', ' ')}`, timestamp: new Date().toISOString() },
              ]
            : state.project.activity,
        },
      };
    }),

  reset: () => set({ project: structuredClone(kemiProject), paymentStatus: 'pending', invoiceApproved: false, currentCash: 0 }),

  derived: () => {
    const { project, currentCash, paymentStatus } = get();
    const impact = calculateDepositImpact(project.costs, project.revenue, project.depositPct, project.expectedPaymentDays, currentCash);
    const expectedProfit = calculateExpectedProfit(project.costs, project.revenue);
    const profitMargin = calculateProfitMargin(project.costs, project.revenue);
    const cashFlow = buildCashFlowProjection(
      project.costs,
      project.revenue,
      project.depositPct,
      project.expectedPaymentDays,
      currentCash,
    );
    const gapDate = paymentStatus === 'verified' ? null : findFirstCashGapDate(cashFlow);

    // Realised days-to-cash: the deposit is treated as verified as soon as
    // an invoice exists (this demo has no real elapsed clock between
    // sessions), and the balance becomes verified once simulatePayment
    // fires. "today" is pinned to the deposit's day (0) while pending,
    // since this demo doesn't track real wall-clock elapsed time — a real
    // backend would use an actual current timestamp here instead.
    const verifiedPayments: VerifiedPaymentEvent[] = [
      { day: 0, amount: impact.depositAmount },
      ...(paymentStatus === 'verified'
        ? [{ day: project.expectedPaymentDays, amount: project.revenue - calculateDepositAmount(project.revenue, project.depositPct) }]
        : []),
    ];
    const daysToCash =
      paymentStatus === 'verified'
        ? calculateRealisedDaysToCash(project.costs, project.revenue, verifiedPayments, project.expectedPaymentDays)
        : calculateDaysToCash(project.expectedPaymentDays);

    return {
      depositAmount: impact.depositAmount,
      upfrontExposure: impact.upfrontExposure,
      cashGap: impact.cashGap,
      expectedProfit,
      profitMargin,
      cashFlow,
      gapDate,
      daysToCash,
    };
  },
}));

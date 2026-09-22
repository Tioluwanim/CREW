import { create } from 'zustand';
import { asoEbiProject } from '../data/demoData';
import type { Project, ProjectCost, PaymentStatus, DaysToCashResult } from '../types';
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

const initialProject = structuredClone(asoEbiProject);

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

  reset: () => set({ project: structuredClone(asoEbiProject), paymentStatus: 'pending', invoiceApproved: false, currentCash: 0 }),

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

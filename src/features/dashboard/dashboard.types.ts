import type { Project } from '../../types';
import type { buildCashFlowProjection } from '../../lib/finance';

export type DashboardCashFlow = ReturnType<typeof buildCashFlowProjection>;

export interface DashboardModel {
  project: Project;
  cashFlow: DashboardCashFlow;
  cashGap: number;
  gapDate: string | null;
  activeCount: number;
  metrics: {
    cashPosition: number;
    owed: number;
    dueThisWeek: number;
  };
  showAllAttention: boolean;
  setShowAllAttention: (show: boolean) => void;
}
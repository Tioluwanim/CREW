import type { Project } from '../../types';
import type { buildCashFlowProjection } from '../../lib/finance';

export type DashboardCashFlow = ReturnType<typeof buildCashFlowProjection>;

/**
 * One row in the needs-attention list. Generalized beyond "cash gap" post-
 * pivot — an approval waiting on a change request is now just as much a
 * needs-attention item as a payment being due or a cash gap opening up.
 */
export interface AttentionItem {
  id: string;
  kind: 'approval' | 'cash_gap' | 'payment_due';
  projectId: string;
  projectName: string;
  clientName: string;
  headline: string;
  amountLabel: string;
  tone: 'thread' | 'gold' | 'default';
}

export interface DashboardModel {
  project: Project;
  cashFlow: DashboardCashFlow;
  gapDate: string | null;
  activeCount: number;
  attentionItems: AttentionItem[];
  metrics: {
    cashPosition: number;
    owed: number;
    dueThisWeek: number;
  };
  showAllAttention: boolean;
  setShowAllAttention: (show: boolean) => void;
}

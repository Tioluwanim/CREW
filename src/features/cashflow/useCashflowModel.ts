'use client';

import { useProjectStore } from '../../store/projectStore';

export function useCashflowModel() {
  const project = useProjectStore((state) => state.project);
  const derived = useProjectStore((state) => state.derived)();
  return {
    project,
    cashFlow: derived.cashFlow,
    cashGap: derived.cashGap,
    gapDate: derived.gapDate,
    currentCash: 0,
    expectedExpenses: project.costs.reduce((sum, cost) => sum + cost.amount, 0),
  };
}
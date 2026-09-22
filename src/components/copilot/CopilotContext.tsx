import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { getCopilotInsight, type CopilotRoute } from '../../services/copilot';
import type { CopilotInsight } from './copilot.types';

interface CopilotContextValue {
  insight: CopilotInsight | null;
  setRoute: (route: CopilotRoute) => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<CopilotRoute>('dashboard');
  const project = useProjectStore((s) => s.project);
  const paymentStatus = useProjectStore((s) => s.paymentStatus);
  const invoiceApproved = useProjectStore((s) => s.invoiceApproved);
  const derived = useProjectStore((s) => s.derived);

  const insight = useMemo(() => {
    const { cashGap, expectedProfit, gapDate } = derived();
    return getCopilotInsight({ route, project, cashGap, expectedProfit, gapDate, paymentStatus, invoiceApproved });
    // derived() intentionally re-runs on every relevant state change below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, project, paymentStatus, invoiceApproved]);

  return <CopilotContext.Provider value={{ insight, setRoute }}>{children}</CopilotContext.Provider>;
}

export function useCopilotContext() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilotContext must be used within CopilotProvider');
  return ctx;
}

/** Pages call this to tell the Copilot which context it should show. */
export function useCopilotRoute(route: CopilotRoute) {
  const { setRoute } = useCopilotContext();
  useEffect(() => {
    setRoute(route);
  }, [route, setRoute]);
}

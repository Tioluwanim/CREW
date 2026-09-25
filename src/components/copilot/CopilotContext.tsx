'use client';

import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { getCopilotInsight, type CopilotRoute } from '../../services/copilot';
import { answerCopilotQuestion, formatDaysToCashLabel, type CopilotChatContext } from '../../services/copilotChat';
import { amaraProfile } from '../../data/demoData';
import type { CopilotInsight, CopilotMessage } from './copilot.types';

interface CopilotContextValue {
  insight: CopilotInsight | null;
  setRoute: (route: CopilotRoute) => void;
  messages: CopilotMessage[];
  /** Seeds the conversation with the current insight as the opening
   * assistant message — a no-op once the conversation already has
   * messages, so re-opening the panel never duplicates it. */
  seedFromInsight: () => void;
  sendMessage: (text: string) => void;
  resetConversation: () => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

function newMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<CopilotRoute>('dashboard');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
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

  const chatContext = useCallback((): CopilotChatContext => {
    const d = derived();
    return {
      project,
      paymentStatus,
      depositAmount: d.depositAmount,
      upfrontExposure: d.upfrontExposure,
      cashGap: d.cashGap,
      expectedProfit: d.expectedProfit,
      profitMargin: d.profitMargin,
      gapDate: d.gapDate,
      daysToCashLabel: formatDaysToCashLabel(d.daysToCash),
      averagePaymentDelayDays: amaraProfile.averagePaymentDelayDays,
      averageMaterialOverrunPct: amaraProfile.averageMaterialOverrunPct,
      typicalDepositPct: amaraProfile.typicalDepositPct,
    };
  }, [derived, project, paymentStatus]);

  const seedFromInsight = useCallback(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      if (!insight) return prev;
      return [{ id: newMessageId(), role: 'assistant', text: `${insight.headline} ${insight.detail}`, actions: insight.actions, createdAt: new Date().toISOString() }];
    });
  }, [insight]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMessage: CopilotMessage = { id: newMessageId(), role: 'user', text: trimmed, createdAt: new Date().toISOString() };
      const answer = answerCopilotQuestion(trimmed, chatContext());
      const assistantMessage: CopilotMessage = {
        id: newMessageId(),
        role: 'assistant',
        text: answer.text,
        actions: answer.actions,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
    },
    [chatContext],
  );

  const resetConversation = useCallback(() => setMessages([]), []);

  return (
    <CopilotContext.Provider value={{ insight, setRoute, messages, seedFromInsight, sendMessage, resetConversation }}>
      {children}
    </CopilotContext.Provider>
  );
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

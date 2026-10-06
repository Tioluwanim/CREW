'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useProjectStore } from '../../store/projectStore';
import { calculateDepositAmount } from '../../lib/finance';
import { formatNaira } from '../../lib/money';
import type { AttentionItem, DashboardModel } from './dashboard.types';

export function useDashboardModel(): DashboardModel {
  const project = useProjectStore((state) => state.project);
  const otherProjects = useWorkspaceStore((state) => state.otherProjects);
  const paymentStatus = useProjectStore((state) => state.paymentStatus);
  const derived = useProjectStore((state) => state.derived)();
  const [showAllAttention, setShowAllAttention] = useState(false);

  const pendingChangeRequests = (project.changeRequests ?? []).filter((cr) => cr.status === 'pending');

  const attentionItems: AttentionItem[] = [
    // Change-request approvals waiting — the pivot's new "needs attention"
    // shape: a scope question, not a cash-flow one.
    ...pendingChangeRequests.map(
      (cr): AttentionItem => ({
        id: cr.id,
        kind: 'approval',
        projectId: project.id,
        projectName: project.name,
        clientName: project.clientName,
        headline: cr.label,
        amountLabel: `${formatNaira(cr.priceImpact)} if extra`,
        tone: 'gold',
      }),
    ),
    // Projected cash gap — still surfaced when a project genuinely has
    // one, just no longer the only kind of attention item that exists.
    ...(paymentStatus !== 'verified' && derived.cashGap > 0
      ? [
          {
            id: `${project.id}-cash-gap`,
            kind: 'cash_gap',
            projectId: project.id,
            projectName: project.name,
            clientName: project.clientName,
            headline: 'Projected cash gap',
            amountLabel: formatNaira(derived.cashGap),
            tone: 'thread',
          } as AttentionItem,
        ]
      : []),
    // Payments due on other in-flight projects.
    ...otherProjects
      .filter((p) => p.status === 'awaiting_payment')
      .map((p): AttentionItem => {
        const balance = p.revenue - calculateDepositAmount(p.revenue, p.depositPct);
        return {
          id: `${p.id}-payment-due`,
          kind: 'payment_due',
          projectId: p.id,
          projectName: p.name,
          clientName: p.clientName,
          headline: 'Balance due',
          amountLabel: formatNaira(balance),
          tone: 'default',
        };
      }),
  ];

  return {
    project,
    cashFlow: derived.cashFlow,
    gapDate: derived.gapDate,
    activeCount: (paymentStatus === 'verified' ? 0 : 1) + otherProjects.filter((item) => item.status !== 'completed').length,
    attentionItems,
    metrics: {
      cashPosition: 324_500,
      owed: 186_000,
      dueThisWeek: 94_000,
    },
    showAllAttention,
    setShowAllAttention,
  };
}

export function useDashboardGreeting() {
  const kemiProfile = useWorkspaceStore((state) => state.profile);
  return {
    ownerName: kemiProfile.ownerName,
    businessName: kemiProfile.businessName,
  };
}

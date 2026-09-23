'use client';

import { useState } from 'react';
import { amaraProfile, otherProjects } from '../../data/demoData';
import { useProjectStore } from '../../store/projectStore';
import type { DashboardModel } from './dashboard.types';

export function useDashboardModel(): DashboardModel {
  const project = useProjectStore((state) => state.project);
  const paymentStatus = useProjectStore((state) => state.paymentStatus);
  const derived = useProjectStore((state) => state.derived)();
  const [showAllAttention, setShowAllAttention] = useState(false);

  return {
    project,
    cashFlow: derived.cashFlow,
    cashGap: derived.cashGap,
    gapDate: derived.gapDate,
    activeCount: (paymentStatus === 'verified' ? 0 : 1) + otherProjects.filter((item) => item.status !== 'completed').length,
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
  return {
    ownerName: amaraProfile.ownerName,
    businessName: amaraProfile.businessName,
  };
}
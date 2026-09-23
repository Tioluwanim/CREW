'use client';

import { useState } from 'react';
import { otherProjects } from '../../data/demoData';
import { calculateExpectedProfit, calculateProfitMargin } from '../../lib/finance';
import { useProjectStore } from '../../store/projectStore';
import type { Project, ProjectStatus } from '../../types';

export const PROJECT_FILTERS = ['All', 'Active', 'Awaiting payment', 'Completed'] as const;
export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  awaiting_payment: 'Awaiting payment',
  completed: 'Completed',
};

export function useProjectsModel() {
  const [filter, setFilter] = useState<ProjectFilter>('All');
  const heroProject = useProjectStore((state) => state.project);
  const heroPaymentStatus = useProjectStore((state) => state.paymentStatus);
  const heroDerived = useProjectStore((state) => state.derived)();
  const heroStatus: ProjectStatus = heroPaymentStatus === 'verified' ? 'completed' : 'active';
  const rows = [
    { project: heroProject, status: heroStatus, profit: heroDerived.expectedProfit, margin: heroDerived.profitMargin, editable: true },
    ...otherProjects.map((project) => ({
      project,
      status: project.status,
      profit: calculateExpectedProfit(project.costs, project.revenue),
      margin: calculateProfitMargin(project.costs, project.revenue),
      editable: false,
    })),
  ];

  return {
    filter,
    setFilter,
    rows: rows.filter((row) => filter === 'All' || STATUS_LABEL[row.status] === filter),
    statusLabel: STATUS_LABEL,
  };
}

export type ProjectRowModel = ReturnType<typeof useProjectsModel>['rows'][number];
export type ProjectRowProject = Project;
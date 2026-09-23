'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '../store/projectStore';
import { useCopilotRoute } from '../components/copilot/CopilotContext';
import { Card, Pill, Button } from '../components/ui/primitives';
import { EmptyState } from '../components/ui/states';
import { formatNaira } from '../lib/money';
import { otherProjects } from '../data/demoData';
import { calculateExpectedProfit, calculateProfitMargin } from '../lib/finance';
import type { Project, ProjectStatus } from '../types';

const FILTERS = ['All', 'Active', 'Awaiting payment', 'Completed'] as const;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  awaiting_payment: 'Awaiting payment',
  completed: 'Completed',
};

export function ProjectsPage() {
  useCopilotRoute('dashboard');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const heroProject = useProjectStore((s) => s.project);
  const heroPaymentStatus = useProjectStore((s) => s.paymentStatus);
  const heroDerived = useProjectStore((s) => s.derived)();

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

  const visibleRows = rows.filter((row) => filter === 'All' || STATUS_LABEL[row.status] === filter);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Projects</h1>
          <p className="mt-1 text-sm text-ink-500">Every project, and what it means for your cash.</p>
        </div>
        <Link href="/app/projects/new">
          <Button>+ New project</Button>
        </Link>
      </header>

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? 'border-ink-900 bg-ink-900 text-bone-50' : 'border-ink-900/15 text-ink-700 hover:border-ink-900/30'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <EmptyState message="Your next project belongs here." />
      ) : (
        <div className="space-y-3">
          {visibleRows.map(({ project, status, profit, margin, editable }) => (
            <ProjectRow key={project.id} project={project} status={status} profit={profit} margin={margin} editable={editable} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  status,
  profit,
  margin,
  editable,
}: {
  project: Project;
  status: ProjectStatus;
  profit: number;
  margin: number;
  editable: boolean;
}) {
  return (
    <Link href={editable ? `/app/projects/${project.id}` : `/app/projects/${project.id}?view=readonly`} className="block">
      <Card className="p-5 transition-colors hover:border-ink-900/25">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-medium text-ink-900">{project.name}</h3>
          <Pill tone={status === 'completed' ? 'verified' : status === 'awaiting_payment' ? 'gold' : 'default'}>
            {STATUS_LABEL[status]}
          </Pill>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Field label="Revenue" value={formatNaira(project.revenue)} />
          <Field label="Profit" value={formatNaira(profit)} />
          <Field label="Margin" value={`${margin.toFixed(1)}%`} />
          <Field label="Deposit" value={`${project.depositPct}%`} />
        </div>
      </Card>
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="num font-medium text-ink-900">{value}</div>
    </div>
  );
}

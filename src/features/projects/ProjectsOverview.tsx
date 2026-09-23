'use client';

import Link from 'next/link';
import { useCopilotRoute } from '../../components/copilot/CopilotContext';
import { Button, Card, Pill } from '../../components/ui/primitives';
import { EmptyState } from '../../components/ui/states';
import { formatNaira } from '../../lib/money';
import { PROJECT_FILTERS, useProjectsModel, type ProjectRowModel } from './useProjectsModel';

export function ProjectsOverview() {
  useCopilotRoute('dashboard');
  const model = useProjectsModel();

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Projects</h1>
          <p className="mt-1 text-sm text-ink-500">Every project, and what it means for your cash.</p>
        </div>
        <Link href="/app/projects/new"><Button>+ New project</Button></Link>
      </header>
      <div className="mb-5 flex gap-2 overflow-x-auto" role="group" aria-label="Project filters">
        {PROJECT_FILTERS.map((filter) => (
          <button key={filter} type="button" onClick={() => model.setFilter(filter)} aria-pressed={model.filter === filter}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 ${model.filter === filter ? 'border-ink-900 bg-ink-900 text-bone-50' : 'border-ink-900/15 text-ink-700 hover:border-ink-900/30'}`}>
            {filter}
          </button>
        ))}
      </div>
      {model.rows.length === 0 ? <EmptyState message="Your next project belongs here." /> : <div className="space-y-3">{model.rows.map((row) => <ProjectRow key={row.project.id} row={row} statusLabel={model.statusLabel[row.status]} />)}</div>}
    </div>
  );
}

function ProjectRow({ row, statusLabel }: { row: ProjectRowModel; statusLabel: string }) {
  return (
    <Link href={row.editable ? `/app/projects/${row.project.id}` : `/app/projects/${row.project.id}?view=readonly`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
      <Card className="p-5 transition-colors hover:border-ink-900/25">
        <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-base font-medium text-ink-900">{row.project.name}</h3><Pill tone={row.status === 'completed' ? 'verified' : row.status === 'awaiting_payment' ? 'gold' : 'default'}>{statusLabel}</Pill></div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Field label="Revenue" value={formatNaira(row.project.revenue)} /><Field label="Profit" value={formatNaira(row.profit)} /><Field label="Margin" value={`${row.margin.toFixed(1)}%`} /><Field label="Deposit" value={`${row.project.depositPct}%`} />
        </div>
      </Card>
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-ink-500">{label}</div><div className="num font-medium text-ink-900">{value}</div></div>;
}
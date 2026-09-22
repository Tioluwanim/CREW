import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useCopilotRoute } from '../components/copilot/CopilotContext';
import { Card, Pill, Button } from '../components/ui/primitives';
import { formatNaira } from '../lib/money';

const FILTERS = ['All', 'Active', 'Awaiting payment', 'Completed'] as const;

export function ProjectsPage() {
  useCopilotRoute('dashboard');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const project = useProjectStore((s) => s.project);
  const paymentStatus = useProjectStore((s) => s.paymentStatus);
  const derived = useProjectStore((s) => s.derived)();

  const displayStatus = paymentStatus === 'verified' ? 'Completed' : 'Active';
  const visible = filter === 'All' || filter === displayStatus;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Projects</h1>
          <p className="mt-1 text-sm text-ink-500">Every project, and what it means for your cash.</p>
        </div>
        <Button>+ New project</Button>
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

      {visible ? (
        <Link to={`/app/projects/${project.id}`} className="block">
          <Card className="p-5 transition-colors hover:border-ink-900/25">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-900">{project.name}</h3>
              <Pill tone={paymentStatus === 'verified' ? 'verified' : 'default'}>{displayStatus}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Field label="Revenue" value={formatNaira(project.revenue)} />
              <Field label="Profit" value={formatNaira(derived.expectedProfit)} />
              <Field label="Margin" value={`${derived.profitMargin.toFixed(1)}%`} />
              <Field label="Deposit" value={`${project.depositPct}%`} />
            </div>
          </Card>
        </Link>
      ) : (
        <Card className="p-8 text-center text-sm text-ink-500">Your next project belongs here.</Card>
      )}
    </div>
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

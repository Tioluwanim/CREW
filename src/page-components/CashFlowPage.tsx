'use client';

import { useProjectStore } from '../store/projectStore';
import { useCopilotRoute } from '../components/copilot/CopilotContext';
import { Card, StatLabel, StatValue } from '../components/ui/primitives';
import { CashFlowChart } from '../components/charts/CashFlowChart';
import { formatNaira } from '../lib/money';

export function CashFlowPage() {
  useCopilotRoute('cashflow');
  const derived = useProjectStore((s) => s.derived)();
  const project = useProjectStore((s) => s.project);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Cash flow</h1>
        <p className="mt-1 text-sm text-ink-500">What's coming in, what's going out, and when.</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <StatLabel>Current cash</StatLabel>
          <StatValue>{formatNaira(0)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Expected inflows</StatLabel>
          <StatValue tone="verified">{formatNaira(project.revenue)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Expected expenses</StatLabel>
          <StatValue tone="thread">{formatNaira(project.costs.reduce((s, c) => s + c.amount, 0))}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Projected gap</StatLabel>
          <StatValue tone={derived.cashGap > 0 ? 'thread' : 'default'}>
            {derived.cashGap > 0 ? formatNaira(derived.cashGap) : 'None'}
          </StatValue>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <CashFlowChart points={derived.cashFlow} />
      </Card>

      {derived.gapDate && (
        <Card className="mb-6 border-thread-600/20 bg-thread-100/50 p-5">
          <p className="text-sm font-medium text-thread-600">
            Your cash may get tight around {new Date(derived.gapDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-700">What can change this?</h2>
        <ul className="space-y-2 text-sm text-ink-700">
          <li>• Deposit — a higher deposit reduces what you spend before you're paid.</li>
          <li>• Payment timing — a shorter payment window closes the gap sooner.</li>
          <li>• Cost reduction — lower upfront costs mean less to cover before revenue lands.</li>
        </ul>
      </Card>
    </div>
  );
}

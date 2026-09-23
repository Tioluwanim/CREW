'use client';

import { useProjectStore } from '../../store/projectStore';
import { useCopilotRoute } from '../../components/copilot/CopilotContext';
import { Card } from '../../components/ui/primitives';
import { amaraProfile } from '../../data/demoData';
import { formatNaira } from '../../lib/money';

export function ProfitOverview() {
  useCopilotRoute('dashboard');
  const project = useProjectStore((state) => state.project);
  const derived = useProjectStore((state) => state.derived)();
  const costs = project.costs.reduce((sum, cost) => sum + cost.amount, 0);
  return <div><header className="mb-6"><h1 className="font-display text-3xl text-ink-900">Profit</h1><p className="mt-1 text-sm text-ink-500">{amaraProfile.businessName} — this month.</p></header><Card className="p-5"><div className="grid grid-cols-3 gap-4 text-sm"><Field label="Revenue" value={formatNaira(project.revenue)} /><Field label="Costs" value={formatNaira(costs)} /><Field label="Profit" value={formatNaira(derived.expectedProfit)} /></div></Card></div>;
}

function Field({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-ink-500">{label}</div><div className="num font-medium text-ink-900">{value}</div></div>; }
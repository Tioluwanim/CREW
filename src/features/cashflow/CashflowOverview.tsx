'use client';

import { useCopilotRoute } from '../../components/copilot/CopilotContext';
import { CashFlowChart } from '../../components/charts/CashFlowChart';
import { Card, StatLabel, StatValue } from '../../components/ui/primitives';
import { formatNaira } from '../../lib/money';
import { useCashflowModel } from './useCashflowModel';

export function CashflowOverview() {
  useCopilotRoute('cashflow');
  const model = useCashflowModel();
  return <div><header className="mb-6"><h1 className="font-display text-3xl text-ink-900">Cash flow</h1><p className="mt-1 text-sm text-ink-500">What's coming in, what's going out, and when.</p></header><div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Current cash" value={formatNaira(model.currentCash)} /><Metric label="Expected inflows" value={formatNaira(model.project.revenue)} tone="verified" /><Metric label="Expected expenses" value={formatNaira(model.expectedExpenses)} tone="thread" /><Metric label="Projected gap" value={model.cashGap > 0 ? formatNaira(model.cashGap) : 'None'} tone={model.cashGap > 0 ? 'thread' : 'default'} /></div><Card className="mb-6 p-5"><CashFlowChart points={model.cashFlow} /></Card>{model.gapDate && <Card className="mb-6 border-thread-600/20 bg-thread-100/50 p-5"><p className="text-sm font-medium text-thread-600">Your cash may get tight around {new Date(model.gapDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.</p></Card>}<Card className="p-5"><h2 className="mb-3 text-sm font-medium text-ink-700">What can change this?</h2><ul className="space-y-2 text-sm text-ink-700"><li>Deposit — a higher deposit reduces what you spend before you're paid.</li><li>Payment timing — a shorter payment window closes the gap sooner.</li><li>Cost reduction — lower upfront costs mean less to cover before revenue lands.</li></ul></Card></div>;
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'thread' | 'verified' }) { return <Card className="p-4"><StatLabel>{label}</StatLabel><StatValue tone={tone}>{value}</StatValue></Card>; }
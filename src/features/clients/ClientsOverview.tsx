'use client';

import { useCopilotRoute } from '../../components/copilot/CopilotContext';
import { Card } from '../../components/ui/primitives';
import { clients } from '../../data/demoData';
import { formatNaira } from '../../lib/money';

export function ClientsOverview() {
  useCopilotRoute('clients');
  return <div><header className="mb-6"><h1 className="font-display text-3xl text-ink-900">Clients</h1><p className="mt-1 text-sm text-ink-500">How your clients actually pay, in plain terms.</p></header><div className="space-y-3">{clients.map((client) => <Card key={client.id} className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-base font-medium text-ink-900">{client.name}</h3><span className="text-xs text-ink-500">{client.averagePaymentDays} day avg. payment</span></div><div className="grid grid-cols-3 gap-4 text-sm"><Field label="Projects" value={String(client.projectIds.length)} /><Field label="Total billed" value={formatNaira(client.totalBilled)} /><Field label="Total paid" value={formatNaira(client.totalPaid)} /></div></Card>)}</div></div>;
}

function Field({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-ink-500">{label}</div><div className="num font-medium text-ink-900">{value}</div></div>; }
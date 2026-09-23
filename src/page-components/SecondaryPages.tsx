'use client';

import { useProjectStore } from '../store/projectStore';
import { useCopilotRoute } from '../components/copilot/CopilotContext';
import { Card, Button, Pill } from '../components/ui/primitives';
import { EcobankBadge } from '../components/ui/EcobankBadge';
import { formatNaira } from '../lib/money';
import { clients, amaraProfile } from '../data/demoData';
import { ClientsOverview } from '../features/clients';
import { InvoiceOverview } from '../features/invoices';
import { ProfitOverview } from '../features/profit';

export function InvoicesPage() {
  return <InvoiceOverview />;
}

export function ClientsPage() {
  return <ClientsOverview />;
}

export function ProfitPage() {
  return <ProfitOverview />;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="num font-medium text-ink-900">{value}</div>
    </div>
  );
}

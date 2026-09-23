'use client';

import { Card, StatLabel } from '../../components/ui/primitives';
import { amaraProfile } from '../../data/demoData';

const metrics = [
  { label: 'Typical deposit', value: `${amaraProfile.typicalDepositPct}%` },
  { label: 'Average payment delay', value: `${amaraProfile.averagePaymentDelayDays} days` },
  { label: 'Average material overrun', value: `${amaraProfile.averageMaterialOverrunPct}%` },
  { label: 'Typical project margin', value: `${amaraProfile.averageMarginPct}%` },
];

export function GenomeOverview() {
  return <Card className="p-5"><h2 className="mb-1 text-sm font-medium text-ink-700">How your business actually behaves</h2><p className="mb-4 text-xs text-ink-500">CREW learns from how your business actually behaves — no mysterious scoring, just your own history. These numbers power cost buffers, delay-aware forecasts, and deposit advice elsewhere in the app.</p><div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">{metrics.map((metric) => <div key={metric.label}><StatLabel>{metric.label}</StatLabel><div className="num text-lg font-medium text-ink-900">{metric.value}</div></div>)}</div></Card>;
}
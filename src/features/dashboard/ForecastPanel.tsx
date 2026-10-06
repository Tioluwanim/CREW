'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/primitives';
import { CashFlowChart, type BandedPoint } from '../../components/charts/CashFlowChart';
import { useLiveBackend } from '../../lib/demoMode';
import { getForecastSeries, type ForecastSeries } from '../../services/forecast';
import type { DashboardCashFlow } from './dashboard.types';

function bandCaption(series: ForecastSeries): string {
  const d = series.delay;
  const days = d?.expectedDays;
  if (series.learned) return `Shaded range: clients paying on time, to about ${d?.pessimisticDays ?? '?'} days late. Lateness is estimated by a model trained on your payment history.`;
  const source = d?.source ? ` (${d.source.replace(/_/g, ' ')})` : '';
  return `Shaded range: clients paying on time, to about ${d?.pessimisticDays ?? '?'} days late. The ${days ?? '?'}-day delay is a starting estimate${source}, not a trained prediction yet.`;
}

export function ForecastPanel({ cashFlow, gapDate }: { cashFlow: DashboardCashFlow; gapDate: string | null }) {
  const live = useLiveBackend();
  const [series, setSeries] = useState<ForecastSeries | null>(null);

  useEffect(() => {
    if (!live) {
      setSeries(null);
      return;
    }
    let cancelled = false;
    getForecastSeries(30)
      .then((s) => !cancelled && setSeries(s))
      .catch(() => !cancelled && setSeries(null)); // fall back to the single-line projection
    return () => {
      cancelled = true;
    };
  }, [live]);

  const banded = live && series && series.points.length > 0 && series.points.every((p) => p.low !== undefined && p.high !== undefined);
  const points: BandedPoint[] = banded
    ? series.points.map((p) => ({ label: p.label, date: p.date, projectedBalance: p.projectedBalance, inflow: 0, outflow: 0, low: p.low, high: p.high }))
    : cashFlow;

  return (
    <Card className="mb-6 p-5">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-ink-700">Forecast — next 30 days</h2>
        {gapDate && <span className="text-right text-xs font-medium text-thread-600">Your cash may get tight in 9 days.</span>}
      </div>
      <CashFlowChart points={points} />
      {banded && series && <p className="mt-2 text-xs text-ink-500">{bandCaption(series)}</p>}
    </Card>
  );
}

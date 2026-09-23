'use client';

import { Card } from '../../components/ui/primitives';
import { CashFlowChart } from '../../components/charts/CashFlowChart';
import type { DashboardCashFlow } from './dashboard.types';

export function ForecastPanel({ cashFlow, gapDate }: { cashFlow: DashboardCashFlow; gapDate: string | null }) {
  return (
    <Card className="mb-6 p-5">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-ink-700">Forecast — next 30 days</h2>
        {gapDate && <span className="text-right text-xs font-medium text-thread-600">Your cash may get tight in 9 days.</span>}
      </div>
      <CashFlowChart points={cashFlow} />
    </Card>
  );
}
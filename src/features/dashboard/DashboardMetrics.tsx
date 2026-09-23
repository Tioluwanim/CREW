'use client';

import { Card, StatLabel, StatValue } from '../../components/ui/primitives';
import { formatNaira } from '../../lib/money';

interface DashboardMetricsProps {
  cashPosition: number;
  owed: number;
  dueThisWeek: number;
  activeCount: number;
}

export function DashboardMetrics({ cashPosition, owed, dueThisWeek, activeCount }: DashboardMetricsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Workspace summary">
      <Card className="p-4">
        <StatLabel>Cash position</StatLabel>
        <StatValue>{formatNaira(cashPosition)}</StatValue>
      </Card>
      <Card className="p-4">
        <StatLabel>Owed to me</StatLabel>
        <StatValue>{formatNaira(owed)}</StatValue>
      </Card>
      <Card className="p-4">
        <StatLabel>Due this week</StatLabel>
        <StatValue tone="thread">{formatNaira(dueThisWeek)}</StatValue>
      </Card>
      <Card className="p-4">
        <StatLabel>Active projects</StatLabel>
        <StatValue>{activeCount}</StatValue>
      </Card>
    </div>
  );
}
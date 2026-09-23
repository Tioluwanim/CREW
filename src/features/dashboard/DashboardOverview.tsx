'use client';

import { useCopilotRoute } from '../../components/copilot/CopilotContext';
import { AttentionPanel } from './AttentionPanel';
import { DashboardHeader } from './DashboardHeader';
import { DashboardMetrics } from './DashboardMetrics';
import { ForecastPanel } from './ForecastPanel';
import { useDashboardModel } from './useDashboardModel';

export function DashboardOverview() {
  useCopilotRoute('dashboard');
  const model = useDashboardModel();

  return (
    <div>
      <DashboardHeader />
      <DashboardMetrics {...model.metrics} activeCount={model.activeCount} />
      <ForecastPanel cashFlow={model.cashFlow} gapDate={model.gapDate} />
      <AttentionPanel
        projectId={model.project.id}
        projectName={model.project.name}
        clientName={model.project.clientName}
        cashGap={model.cashGap}
        showAll={model.showAllAttention}
        onToggle={() => model.setShowAllAttention(!model.showAllAttention)}
      />
    </div>
  );
}
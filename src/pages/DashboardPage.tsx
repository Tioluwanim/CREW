import { Link } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useCopilotRoute } from '../components/copilot/CopilotContext';
import { Card, StatLabel, StatValue } from '../components/ui/primitives';
import { CashFlowChart } from '../components/charts/CashFlowChart';
import { formatNaira } from '../lib/money';
import { amaraProfile } from '../data/demoData';

export function DashboardPage() {
  useCopilotRoute('dashboard');
  const project = useProjectStore((s) => s.project);
  const derived = useProjectStore((s) => s.derived)();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Good morning, {amaraProfile.ownerName}</h1>
        <p className="mt-1 text-sm text-ink-500">Here's where {amaraProfile.businessName} stands today.</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <StatLabel>Cash position</StatLabel>
          <StatValue>{formatNaira(324_500)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Owed to me</StatLabel>
          <StatValue>{formatNaira(186_000)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Due this week</StatLabel>
          <StatValue tone="thread">{formatNaira(94_000)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Active projects</StatLabel>
          <StatValue>6</StatValue>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-700">Forecast — next 30 days</h2>
          {derived.gapDate && <span className="text-xs font-medium text-thread-600">Your cash may get tight in 9 days.</span>}
        </div>
        <CashFlowChart points={derived.cashFlow} />
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-700">Attention needed</h2>
          <Link to="/app/projects" className="text-xs font-medium text-ink-500 hover:text-ink-900">
            View all
          </Link>
        </div>
        <Link
          to={`/app/projects/${project.id}`}
          className="flex items-center justify-between rounded-lg border border-ink-900/10 p-3.5 transition-colors hover:border-ink-900/25"
        >
          <div>
            <div className="text-sm font-medium text-ink-900">{project.name}</div>
            <div className="text-xs text-ink-500">{project.clientName}</div>
          </div>
          <div className="text-right">
            <div className="num text-sm font-medium text-thread-600">{formatNaira(derived.cashGap)}</div>
            <div className="text-xs text-ink-500">projected gap</div>
          </div>
        </Link>
      </Card>
    </div>
  );
}

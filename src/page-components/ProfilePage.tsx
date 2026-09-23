import { Card, StatLabel } from '../components/ui/primitives';
import { GenomeOverview } from '../features/genome';
import { formatNaira } from '../lib/money';
import { amaraProfile } from '../data/demoData';

const GENOME_METRICS = [
  { label: 'Typical deposit', value: `${amaraProfile.typicalDepositPct}%` },
  { label: 'Average payment delay', value: `${amaraProfile.averagePaymentDelayDays} days` },
  { label: 'Average material overrun', value: `${amaraProfile.averageMaterialOverrunPct}%` },
  { label: 'Typical project margin', value: `${amaraProfile.averageMarginPct}%` },
];

export function ProfilePage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">{amaraProfile.businessName}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {amaraProfile.craft} · {amaraProfile.location}
        </p>
      </header>

      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-700">Business profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <StatLabel>Projects completed</StatLabel>
            <div className="num text-lg font-medium text-ink-900">{amaraProfile.projectsCompleted}</div>
          </div>
          <div>
            <StatLabel>Average project value</StatLabel>
            <div className="num text-lg font-medium text-ink-900">{formatNaira(amaraProfile.averageProjectValue)}</div>
          </div>
        </div>
      </Card>

      <GenomeOverview />
    </div>
  );
}

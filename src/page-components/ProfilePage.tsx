import { Card, StatLabel } from '../components/ui/primitives';
import { GenomeOverview } from '../features/genome';
import { VerifiedBadgeRow } from '../features/badges/VerifiedBadgeRow';
import { formatNaira } from '../lib/money';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { CreativeProfile } from '../types';

const genomeMetrics = (kemiProfile: CreativeProfile) => [
  { label: 'Typical deposit', value: `${kemiProfile.typicalDepositPct}%` },
  { label: 'Average payment delay', value: `${kemiProfile.averagePaymentDelayDays} days` },
  { label: 'Average material overrun', value: `${kemiProfile.averageMaterialOverrunPct}%` },
  { label: 'Typical project margin', value: `${kemiProfile.averageMarginPct}%` },
];

export function ProfilePage() {
  const kemiProfile = useWorkspaceStore((s) => s.profile);
  const GENOME_METRICS = genomeMetrics(kemiProfile);
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">{kemiProfile.businessName}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {kemiProfile.craft} · {kemiProfile.location}
        </p>
        <div className="mt-3">
          <VerifiedBadgeRow profile={kemiProfile} />
        </div>
      </header>

      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-sm font-medium text-ink-700">Business profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <StatLabel>Projects completed</StatLabel>
            <div className="num text-lg font-medium text-ink-900">{kemiProfile.projectsCompleted}</div>
          </div>
          <div>
            <StatLabel>Average project value</StatLabel>
            <div className="num text-lg font-medium text-ink-900">{formatNaira(kemiProfile.averageProjectValue)}</div>
          </div>
        </div>
      </Card>

      <GenomeOverview />
    </div>
  );
}

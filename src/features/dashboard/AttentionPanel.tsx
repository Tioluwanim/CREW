'use client';

import Link from 'next/link';
import { Card } from '../../components/ui/primitives';
import { formatNaira } from '../../lib/money';

interface AttentionPanelProps {
  projectId: string;
  projectName: string;
  clientName: string;
  cashGap: number;
  showAll: boolean;
  onToggle: () => void;
}

export function AttentionPanel({ projectId, projectName, clientName, cashGap, showAll, onToggle }: AttentionPanelProps) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-ink-700">Attention needed</h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={showAll}
          className="rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-900/5 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
        >
          {showAll ? 'Show less' : 'View all'}
        </button>
      </div>
      <Link
        href={`/app/projects/${projectId}`}
        className="flex items-center justify-between rounded-lg border border-ink-900/10 p-3.5 transition-colors hover:border-ink-900/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
      >
        <div>
          <div className="text-sm font-medium text-ink-900">{projectName}</div>
          <div className="text-xs text-ink-500">{clientName}</div>
        </div>
        <div className="text-right">
          <div className="num text-sm font-medium text-thread-600">{formatNaira(cashGap)}</div>
          <div className="text-xs text-ink-500">projected gap</div>
        </div>
      </Link>
      {showAll && <p className="mt-3 text-xs text-ink-500">Your project list includes completed work and projects still awaiting payment.</p>}
    </Card>
  );
}
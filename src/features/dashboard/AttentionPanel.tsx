'use client';

import Link from 'next/link';
import { Card, Pill } from '../../components/ui/primitives';
import type { AttentionItem } from './dashboard.types';

interface AttentionPanelProps {
  items: AttentionItem[];
  showAll: boolean;
  onToggle: () => void;
}

const TONE_CLASSES: Record<AttentionItem['tone'], string> = {
  thread: 'text-thread-600',
  gold: 'text-gold-500',
  default: 'text-ink-700',
};

const KIND_LABEL: Record<AttentionItem['kind'], string> = {
  approval: 'Approval waiting',
  cash_gap: 'Cash gap',
  payment_due: 'Payment due',
};

export function AttentionPanel({ items, showAll, onToggle }: AttentionPanelProps) {
  const visible = showAll ? items : items.slice(0, 3);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-ink-700">Attention needed</h2>
        {items.length > 3 && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={showAll}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-900/5 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          >
            {showAll ? 'Show less' : 'View all'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-ink-900/10 p-3.5 text-sm text-ink-500">Nothing needs your attention right now.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => (
            <Link
              key={item.id}
              href={`/app/projects/${item.projectId}`}
              className="flex items-center justify-between rounded-lg border border-ink-900/10 p-3.5 transition-colors hover:border-ink-900/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
            >
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Pill>{KIND_LABEL[item.kind]}</Pill>
                  <span className="text-sm font-medium text-ink-900">{item.headline}</span>
                </div>
                <div className="text-xs text-ink-500">
                  {item.projectName} · {item.clientName}
                </div>
              </div>
              <div className={`num text-sm font-medium ${TONE_CLASSES[item.tone]}`}>{item.amountLabel}</div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

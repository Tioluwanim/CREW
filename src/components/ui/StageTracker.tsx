import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Where a project is in its life, at a glance. `current` is the index of the step in progress;
 * a value equal to `steps.length` means everything is done. On narrow screens only the current step is
 * named (with a progress bar) so the labels never wrap or scroll sideways.
 */
export function StageTracker({ steps, current, label = 'Project progress', className }: { steps: readonly string[]; current: number; label?: string; className?: string }) {
  const done = current >= steps.length;
  const idx = Math.min(Math.max(current, 0), steps.length - 1);
  return (
    <div className={className}>
      <div className="sm:hidden" role="group" aria-label={label}>
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="font-medium text-ink-900">{done ? 'All done' : steps[idx]}</span>
          <span className="text-ink-500">{done ? `${steps.length} of ${steps.length}` : `Step ${idx + 1} of ${steps.length}`}</span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <div key={s} className={cn('h-1.5 flex-1 rounded-full', i < current || done ? 'bg-ink-900' : i === current ? 'bg-gold-500' : 'bg-ink-900/10')} />
          ))}
        </div>
      </div>

      <ol className="hidden items-start sm:flex" aria-label={label}>
        {steps.map((s, i) => {
          const complete = i < current || done;
          const active = i === current && !done;
          return (
            <li key={s} aria-current={active ? 'step' : undefined} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span aria-hidden className={cn('absolute right-1/2 top-3 h-px w-full -translate-y-1/2', i <= current || done ? 'bg-ink-900' : 'bg-ink-900/15')} />}
              <span
                className={cn(
                  'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium',
                  complete && 'border-ink-900 bg-ink-900 text-bone-50',
                  active && 'border-gold-500 bg-bone-50 text-ink-900 ring-4 ring-gold-500/20',
                  !complete && !active && 'border-ink-900/20 bg-bone-50 text-ink-500',
                )}
              >
                {complete ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('mt-2 px-1 text-xs leading-tight', active ? 'font-medium text-ink-900' : complete ? 'text-ink-700' : 'text-ink-500')}>{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Creator-facing steps, mapped from the backend lifecycle stage. */
export const CREATOR_STEPS = ['Brief', 'Agreed', 'Deposit paid', 'In progress', 'In review', 'Approved', 'Paid out'] as const;
const CREATOR_INDEX: Record<string, number> = { brief: 0, agreed: 1, funded: 2, in_progress: 3, in_review: 4, approved: 5, released: 6, closed: 7 };
export function creatorStepIndex(stage: string | undefined): number {
  return CREATOR_INDEX[stage ?? 'brief'] ?? 0;
}

/** Client-facing steps, in plain language. */
export const CLIENT_STEPS = ['Agree', 'Pay deposit', 'Work', 'Review', 'Done'] as const;
const CLIENT_INDEX: Record<string, number> = { brief: 0, agreed: 1, funded: 2, in_progress: 2, in_review: 3, approved: 4, released: 5, closed: 5 };
export function clientStepIndex(stage: string): number {
  return CLIENT_INDEX[stage] ?? 0;
}

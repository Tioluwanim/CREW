import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Card } from './primitives';

export function EmptyState({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center gap-1 p-10 text-center">
      <p className="text-sm text-ink-500">{message}</p>
    </Card>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-ink-900/10 bg-white p-5">
          <div className="mb-3 h-3 w-1/3 rounded bg-ink-900/10" />
          <div className="h-6 w-2/3 rounded bg-ink-900/10" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message = "CREW couldn't load this right now.", detail, onRetry }: { message?: string; detail?: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-sm font-medium text-ink-900">{message}</p>
      {detail && <p className="text-xs text-ink-500">{detail}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-1">
          <RefreshCw size={14} /> Try again
        </Button>
      )}
    </Card>
  );
}

/** Wraps a section with loading / error / empty handling so screens don't each reinvent this. */
export function AsyncSection({
  status,
  loadingRows = 3,
  emptyMessage,
  isEmpty,
  errorMessage,
  onRetry,
  children,
}: {
  status: 'loading' | 'error' | 'ready';
  loadingRows?: number;
  emptyMessage?: string;
  isEmpty?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (status === 'loading') return <LoadingSkeleton rows={loadingRows} />;
  if (status === 'error') return <ErrorState message={errorMessage} onRetry={onRetry} />;
  if (isEmpty && emptyMessage) return <EmptyState message={emptyMessage} />;
  return <>{children}</>;
}

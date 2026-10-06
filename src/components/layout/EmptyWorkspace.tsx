import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card } from '../ui/primitives';

/** Shown in place of a project screen when a signed-in account has no projects yet. */
export function EmptyWorkspace() {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-10 text-center">
      <h1 className="font-display text-2xl text-ink-900">Start with your first project</h1>
      <p className="mt-2 text-sm text-ink-500">
        Add a client, a price and your costs. CREW works out your deposit, cash gap and profit from them, and your dashboard fills in as you go.
      </p>
      <Link
        href="/app/projects/new"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-bone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
      >
        <Plus size={16} /> New project
      </Link>
    </Card>
  );
}

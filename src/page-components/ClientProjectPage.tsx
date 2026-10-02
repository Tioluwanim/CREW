'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Flag, Check } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { otherProjects, kemiProfile } from '../data/demoData';
import { Card, Pill, Button, StatLabel } from '../components/ui/primitives';
import { VerifiedBadgeRow } from '../features/badges/VerifiedBadgeRow';
import { EmptyState } from '../components/ui/states';
import { formatNaira } from '../lib/money';
import { calculateDepositAmount } from '../lib/finance';
import type { Project, ScopeItem } from '../types';

/**
 * The no-signup client view — a public link, not the internal /app
 * workspace. No AppShell chrome, no creator nav: this is what a brand
 * contact sees when a creator sends them "crew.app/pay/{projectId}".
 *
 * Approve/flag on a scope item is a lightweight, this-session-only
 * acknowledgment (there's no per-viewer identity to persist it against
 * in this demo). Approving/rejecting a change request and paying are
 * real actions against the shared project store — the same state the
 * creator's workspace reads, so an action taken here shows up there too.
 */
export function ClientProjectPage() {
  const { id } = useParams<{ id: string }>();
  const heroProject = useProjectStore((s) => s.project);
  const approveChangeRequest = useProjectStore((s) => s.approveChangeRequest);
  const rejectChangeRequest = useProjectStore((s) => s.rejectChangeRequest);
  const advanceMilestone = useProjectStore((s) => s.advanceMilestone);
  const simulatePayment = useProjectStore((s) => s.simulatePayment);

  const isHero = !id || id === heroProject.id;
  const staticProject = isHero ? null : otherProjects.find((p) => p.id === id);
  const project: Project | null = isHero ? heroProject : (staticProject ?? null);

  const [approvedItems, setApprovedItems] = useState<Set<string>>(new Set());
  const [flaggedItems, setFlaggedItems] = useState<Set<string>>(new Set());

  if (!project) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState message="This link doesn't match a project in the demo dataset." />
      </div>
    );
  }

  function toggleApproved(itemId: string) {
    setApprovedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleFlagged(itemId: string) {
    setFlaggedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const depositAmount = calculateDepositAmount(project.revenue, project.depositPct);
  const dueMilestone = project.milestones?.find((m) => m.status === 'agreed');

  function payNow() {
    if (!dueMilestone) return;
    if (dueMilestone.id === 'ms-balance') simulatePayment();
    advanceMilestone(dueMilestone.id);
  }

  return (
    <main className="atelier-paper min-h-screen px-6 py-12 text-ink-900 sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Sent to you by {project.craft === 'Content Creator' ? 'a creator' : 'your creative'} on CREW</p>
          <h1 className="mt-1 font-display text-3xl">{project.name}</h1>
          <p className="mt-1 text-sm text-ink-500">{project.clientName}</p>
          {isHero && (
            <div className="mt-3 flex justify-center">
              <VerifiedBadgeRow profile={kemiProfile} />
            </div>
          )}
        </div>

        {project.scope && project.scope.length > 0 && (
          <Card className="mb-5 p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-700">Scope</h2>
            <ul className="space-y-2">
              {project.scope.map((item) => (
                <ScopeRow
                  key={item.id}
                  item={item}
                  approved={approvedItems.has(item.id)}
                  flagged={flaggedItems.has(item.id)}
                  onApprove={() => toggleApproved(item.id)}
                  onFlag={() => toggleFlagged(item.id)}
                />
              ))}
            </ul>
          </Card>
        )}

        {(project.changeRequests ?? [])
          .filter((cr) => cr.classification === 'extra' && cr.status === 'pending')
          .map((cr) => (
            <Card key={cr.id} className="mb-5 border-gold-500/30 bg-gold-100/40 p-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gold-500">Change request</p>
              <p className="mb-3 text-sm text-ink-900">
                {cr.label} — classified as extra work, {formatNaira(cr.priceImpact)}
              </p>
              {cr.clientApproved ? (
                <p className="text-sm text-verified-600">You've approved this — waiting on the creator.</p>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => approveChangeRequest(cr.id, 'client')}>Approve</Button>
                  <Button variant="secondary" onClick={() => rejectChangeRequest(cr.id)}>
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}

        {(project.changeRequests ?? [])
          .filter((cr) => cr.status === 'accepted')
          .map((cr) => (
            <Card key={cr.id} className="mb-5 p-5 text-sm text-verified-600">
              "{cr.label}" is agreed{cr.classification === 'extra' ? ` — ${formatNaira(cr.priceImpact)} added to the total` : ' — included at no extra charge'}.
            </Card>
          ))}

        {(project.changeRequests ?? [])
          .filter((cr) => cr.status === 'rejected')
          .map((cr) => (
            <Card key={cr.id} className="mb-5 p-5 text-sm text-ink-500">
              "{cr.label}" was rejected — no change to scope or price.
            </Card>
          ))}

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <StatLabel>Total</StatLabel>
            <div className="num text-xl font-medium">{formatNaira(project.revenue)}</div>
          </div>
          <div className="mb-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Deposit</span>
              <span className="num text-ink-900">
                {project.depositPct}% · {formatNaira(depositAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Balance</span>
              <span className="num text-ink-900">{formatNaira(project.revenue - depositAmount)}</span>
            </div>
          </div>

          {isHero && dueMilestone ? (
            <Button className="w-full justify-center" onClick={payNow}>
              Pay {dueMilestone.label.toLowerCase()} — {formatNaira(dueMilestone.amount)} (simulated)
            </Button>
          ) : (
            <div className="rounded-lg border border-verified-600/20 bg-verified-100/50 p-3 text-center text-sm text-verified-600">
              {isHero ? 'All milestones paid.' : 'This is a read-only demo project.'}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

function ScopeRow({
  item,
  approved,
  flagged,
  onApprove,
  onFlag,
}: {
  item: ScopeItem;
  approved: boolean;
  flagged: boolean;
  onApprove: () => void;
  onFlag: () => void;
}) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${flagged ? 'border-thread-600/30 bg-thread-100/40' : 'border-ink-900/10'}`}>
      <div>
        <span className="text-sm text-ink-900">
          {item.quantity} {item.unit}
          {item.quantity > 1 ? 's' : ''} — {item.label}
          {item.quantity > 1 ? 's' : ''}
        </span>
        {item.status === 'appended' && (
          <span className="ml-2">
            <Pill tone="verified">Added</Pill>
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onApprove}
          aria-pressed={approved}
          className={`rounded-full p-1.5 transition-colors ${approved ? 'bg-verified-100 text-verified-600' : 'text-ink-400 hover:bg-ink-900/5'}`}
          aria-label={`Approve ${item.label}`}
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          onClick={onFlag}
          aria-pressed={flagged}
          className={`rounded-full p-1.5 transition-colors ${flagged ? 'bg-thread-100 text-thread-600' : 'text-ink-400 hover:bg-ink-900/5'}`}
          aria-label={`Flag ${item.label}`}
        >
          <Flag size={15} />
        </button>
      </div>
    </li>
  );
}

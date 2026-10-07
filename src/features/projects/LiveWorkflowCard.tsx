'use client';

import { useState } from 'react';
import { Card, Button, Pill } from '../../components/ui/primitives';
import * as api from '../../services/projectActions';
import type { Project } from '../../types';

type RunRemote = (remote: (projectId: string) => Promise<unknown>) => Promise<void>;

const STAGE_LABEL: Record<string, string> = {
  brief: 'Brief',
  agreed: 'Agreed',
  funded: 'Funded',
  in_progress: 'In progress',
  in_review: 'In review',
  approved: 'Approved',
  released: 'Released',
  closed: 'Closed',
};

/**
 * Live accounts only. The backend moves a project through brief → agreed → funded → in progress →
 * in review → approved → released → closed, and each step has a guard (for example, the client cannot
 * agree until there is at least one deliverable). This card lists the deliverables and offers the one
 * next step the creator can take, so the whole flow can be driven from the UI.
 */
export function LiveWorkflowCard({ project, run }: { project: Project; run: RunRemote }) {
  const stage = project.stage ?? 'brief';
  const deliverables = project.deliverables ?? [];
  const [title, setTitle] = useState('');
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const canEditScope = stage === 'brief' || stage === 'agreed';
  const anyDelivered = deliverables.some((d) => d.status === 'delivered');

  let next: { text: string; action?: { label: string; run: () => Promise<void> }; extra?: { label: string; run: () => Promise<void> } };
  switch (stage) {
    case 'brief':
      next = {
        text: deliverables.length === 0 ? 'Add what you will deliver. The client can agree once there is at least one item.' : 'Send the client link. They agree to the scope and price, or you can mark it agreed yourself.',
        action: deliverables.length > 0 ? { label: 'Mark scope agreed', run: () => run((id) => api.advanceStage(id, 'agreed')) } : undefined,
      };
      break;
    case 'agreed':
      next = { text: 'Waiting for the deposit. The project becomes funded as soon as the deposit payment is verified.' };
      break;
    case 'funded':
      next = { text: 'Deposit received. Start the work.', action: { label: 'Start work', run: () => run((id) => api.advanceStage(id, 'in_progress')) } };
      break;
    case 'in_progress':
      next = {
        text: anyDelivered ? 'Send what you delivered to the client for review.' : 'Mark each item delivered as you finish it.',
        action: anyDelivered ? { label: 'Send for client review', run: () => run((id) => api.advanceStage(id, 'in_review')) } : undefined,
      };
      break;
    case 'in_review':
      next = { text: 'Waiting for the client to approve or request a revision on their link.' };
      break;
    case 'approved':
      next = {
        text: 'Everything is approved. Send the balance invoice if the client still owes money, then release the funds to your payout account.',
        action: { label: 'Release funds', run: () => run((id) => api.releaseFunds(id)) },
        extra: { label: 'Send balance invoice', run: () => run((id) => api.approveAndSendInvoice(id, undefined, 'balance')) },
      };
      break;
    case 'released':
      next = { text: 'Funds released. Close the project to finish.', action: { label: 'Close project', run: () => run((id) => api.advanceStage(id, 'closed')) } };
      break;
    default:
      next = { text: 'This project is finished.' };
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-700">Project workflow</h2>
        <Pill tone={stage === 'closed' || stage === 'released' ? 'verified' : 'default'}>{STAGE_LABEL[stage] ?? stage}</Pill>
      </div>
      <p className="mb-4 text-sm text-ink-900">{next.text}</p>
      {next.action && (
        <div className="mb-5 flex flex-wrap gap-2">
          {next.extra && (
            <Button variant="secondary" onClick={next.extra.run}>
              {next.extra.label}
            </Button>
          )}
          <Button onClick={next.action.run}>{next.action.label}</Button>
        </div>
      )}

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Deliverables</h3>
      {deliverables.length === 0 && <p className="mb-3 text-sm text-ink-500">None yet.</p>}
      <ul className="mb-3 space-y-2">
        {deliverables.map((d) => (
          <li key={d.id} className="rounded-lg border border-ink-900/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-900">{d.title}</span>
              <Pill tone={d.status === 'approved' ? 'verified' : d.status === 'delivered' ? 'gold' : 'default'}>{d.status.replace('_', ' ')}</Pill>
            </div>
            {stage === 'in_progress' && (d.status === 'pending' || d.status === 'revision_requested') && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  aria-label={`Link to ${d.title} (optional)`}
                  placeholder="Link to the finished work (optional)"
                  value={evidence[d.id] ?? ''}
                  onChange={(e) => setEvidence((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-ink-900/15 bg-white px-2 py-1.5 text-sm"
                />
                <Button variant="secondary" onClick={() => run((id) => api.markDelivered(id, d.id, evidence[d.id]?.trim() || undefined))}>
                  Mark delivered
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEditScope && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-ink-500">
            Add a deliverable
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 20 edited photos"
              className="mt-1 w-full rounded-md border border-ink-900/15 bg-white px-2 py-1.5 text-sm text-ink-900"
            />
          </label>
          <Button
            variant="secondary"
            disabled={!title.trim()}
            onClick={async () => {
              await run((id) => api.addDeliverable(id, { title: title.trim() }));
              setTitle('');
            }}
          >
            Add
          </Button>
        </div>
      )}
    </Card>
  );
}

'use client';

import { Check, X } from 'lucide-react';
import type { CopilotProposal } from './copilot.types';
import { cn } from '../../lib/cn';

interface ProposalCardProps {
  proposal: CopilotProposal;
  status: 'pending' | 'accepted' | 'dismissed';
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * Renders one of the three agent-tool proposals inline in the chat, with
 * explicit Accept/Dismiss controls — the "human confirms" half of
 * Copilot's propose/confirm pattern. Once resolved, the buttons are gone
 * for good (see CopilotContext.resolveProposal's one-way guard) and the
 * card just states what happened.
 */
export function ProposalCard({ proposal, status, onAccept, onDismiss }: ProposalCardProps) {
  return (
    <div className="w-full rounded-xl border border-gold-500/25 bg-gold-500/10 p-3">
      <ProposalBody proposal={proposal} />

      {status === 'pending' && (
        <div className="mt-3 flex gap-1.5">
          <button
            onClick={onAccept}
            className="flex items-center gap-1 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-gold-500/90"
          >
            <Check size={12} /> {acceptLabel(proposal)}
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-bone-50 hover:bg-white/20"
          >
            <X size={12} /> Dismiss
          </button>
        </div>
      )}

      {status !== 'pending' && (
        <p className={cn('mt-2 text-xs font-medium', status === 'accepted' ? 'text-verified-100' : 'text-bone-200/50')}>
          {status === 'accepted' ? resolvedLabel(proposal) : 'Dismissed'}
        </p>
      )}
    </div>
  );
}

function ProposalBody({ proposal }: { proposal: CopilotProposal }) {
  if (proposal.kind === 'scope') {
    return (
      <ul className="space-y-1 text-xs text-bone-100">
        {proposal.items.map((item) => (
          <li key={item.id}>
            {item.quantity} {item.unit}
            {item.quantity > 1 ? 's' : ''} — {item.label}
            {item.quantity > 1 ? 's' : ''}
          </li>
        ))}
      </ul>
    );
  }

  if (proposal.kind === 'classification') {
    return (
      <div className="text-xs text-bone-100">
        <p className="mb-1 font-medium text-gold-500">Suggested: {proposal.classification === 'extra' ? 'Extra' : 'Included'}</p>
        <p className="leading-relaxed text-bone-200/80">{proposal.reason}</p>
      </div>
    );
  }

  return <p className="text-xs italic leading-relaxed text-bone-100">"{proposal.message}"</p>;
}

function acceptLabel(proposal: CopilotProposal) {
  if (proposal.kind === 'scope') return 'Use this scope';
  if (proposal.kind === 'classification') return `Classify as ${proposal.classification}`;
  return 'Copy message';
}

function resolvedLabel(proposal: CopilotProposal) {
  if (proposal.kind === 'scope') return 'Applied to Scope';
  if (proposal.kind === 'classification') return 'Classification applied';
  return 'Copied to clipboard';
}

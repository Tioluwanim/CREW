'use client';

import { motion } from 'framer-motion';
import { CopilotAvatarMark } from './CopilotAvatarMark';
import type { CopilotInsight } from './copilot.types';

interface CopilotButtonProps {
  insight: CopilotInsight | null;
  isOpen: boolean;
  onClick: () => void;
}

/**
 * The default, always-visible floating control — an avatar, not a
 * generic AI icon. Always reachable (even with nothing proactive to say)
 * so the person can open it for a question at any time; widens and gets
 * a slow breathing pulse specifically when there's something worth
 * flagging (a cash gap, an invoice waiting on approval) so it visibly
 * "pops in" rather than silently updating its label.
 */
export function CopilotButton({ insight, isOpen, onClick }: CopilotButtonProps) {
  const hasInsight = Boolean(insight) && insight!.kind !== 'general';

  return (
    <motion.button
      layout
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label={hasInsight ? `CREW Copilot: ${insight!.headline}` : 'Open CREW Copilot'}
      className="pointer-events-auto flex max-w-[min(90vw,22rem)] items-center gap-2.5 rounded-full border border-ink-900/10 bg-ink-900 py-2 pl-2 pr-4 text-left text-bone-50 shadow-xl shadow-ink-900/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
      whileTap={{ scale: 0.97 }}
    >
      <motion.span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center"
        animate={hasInsight ? { scale: [1, 1.07, 1] } : { scale: 1 }}
        transition={hasInsight ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <CopilotAvatarMark size={36} />
        {hasInsight && (
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-thread-600 ring-2 ring-ink-900" aria-hidden />
        )}
      </motion.span>
      {hasInsight ? (
        <span className="flex flex-col overflow-hidden">
          <span className="text-[11px] font-medium uppercase tracking-wide text-bone-200/70">Copilot</span>
          <span className="truncate text-sm font-medium">{insight!.headline}</span>
        </span>
      ) : (
        <span className="text-sm font-medium">Ask Copilot</span>
      )}
    </motion.button>
  );
}

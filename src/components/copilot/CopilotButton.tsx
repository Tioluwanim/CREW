import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { CopilotInsight } from './copilot.types';

interface CopilotButtonProps {
  insight: CopilotInsight | null;
  isOpen: boolean;
  onClick: () => void;
}

/**
 * The default, always-visible floating control. Compact when idle;
 * widens to surface a one-line insight when there's something worth
 * flagging (e.g. a cash gap). Never covers primary content or the
 * mobile bottom nav — layout offsets are handled by the parent.
 */
export function CopilotButton({ insight, isOpen, onClick }: CopilotButtonProps) {
  const hasInsight = Boolean(insight) && insight!.kind !== 'general';

  return (
    <motion.button
      layout
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label={hasInsight ? `CREW Copilot: ${insight!.headline}` : 'Open CREW Copilot'}
      className="pointer-events-auto flex max-w-[min(90vw,22rem)] items-center gap-2.5 rounded-full border border-ink-900/10 bg-ink-900 px-4 py-3 text-left text-bone-50 shadow-xl shadow-ink-900/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
      whileTap={{ scale: 0.97 }}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500/90 text-ink-950">
        <Sparkles size={13} strokeWidth={2.5} />
      </span>
      {hasInsight ? (
        <span className="flex flex-col overflow-hidden">
          <span className="text-[11px] font-medium uppercase tracking-wide text-bone-200/70">Copilot</span>
          <span className="truncate text-sm font-medium">{insight!.headline}</span>
        </span>
      ) : (
        <span className="text-sm font-medium">Copilot — your money, explained.</span>
      )}
    </motion.button>
  );
}

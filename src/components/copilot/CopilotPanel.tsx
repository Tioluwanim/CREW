'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { CopilotInsight as CopilotInsightType, CopilotAction as CopilotActionType } from './copilot.types';
import { CopilotInsight } from './CopilotInsight';
import { CopilotAction } from './CopilotAction';

interface CopilotPanelProps {
  insight: CopilotInsightType;
  onClose: () => void;
  onAction: (action: CopilotActionType) => void;
}

export function CopilotPanel({ insight, onClose, onAction }: CopilotPanelProps) {
  return (
    <motion.div
      role="dialog"
      aria-label="CREW Copilot"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="pointer-events-auto w-[min(92vw,23rem)] origin-bottom-right rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-2xl shadow-ink-950/40"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-bone-200/60">CREW Copilot</span>
        <button
          onClick={onClose}
          aria-label="Close Copilot"
          className="rounded-full p-1 text-bone-200/70 hover:bg-white/10 hover:text-bone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
        >
          <X size={16} />
        </button>
      </div>

      <CopilotInsight insight={insight} />

      {insight.actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {insight.actions.map((action, i) => (
            <CopilotAction key={action.id} action={action} onSelect={onAction} variant={i === 0 ? 'primary' : 'secondary'} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

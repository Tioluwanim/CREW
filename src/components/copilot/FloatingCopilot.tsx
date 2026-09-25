'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CopilotButton } from './CopilotButton';
import { CopilotPanel } from './CopilotPanel';
import { useCopilotContext } from './CopilotContext';
import type { CopilotAction } from './copilot.types';

/**
 * Floating intelligence layer. Lives at the layout level (mounted once,
 * see AppShell) so it persists across route changes instead of being
 * re-created per page. Reads its current insight from CopilotContext,
 * which is fed by whichever screen is active.
 *
 * Always rendered now — previously this returned null whenever there was
 * no proactive insight, which meant Copilot was unreachable for a
 * free-text question unless something was already flagged. The avatar
 * still visibly "pops" (see CopilotButton) when there's something worth
 * surfacing; it's just no longer the only way in.
 */
export function FloatingCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const { insight, messages, seedFromInsight, sendMessage } = useCopilotContext();
  const router = useRouter();

  function handleOpen() {
    seedFromInsight();
    setIsOpen(true);
  }

  function handleAction(action: CopilotAction) {
    switch (action.kind) {
      case 'view_forecast':
      case 'show_gap':
        router.push('/app/cash-flow');
        break;
      case 'simulate_deposit':
        router.push('/app/projects/project-asoebi');
        break;
      case 'review_invoice':
        router.push('/app/invoices');
        break;
      case 'view_history':
        router.push('/app/clients');
        break;
    }
    setIsOpen(false);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6"
      style={{ paddingBottom: 'max(5.5rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <div className="flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen && (
            <CopilotPanel messages={messages} onClose={() => setIsOpen(false)} onSend={sendMessage} onAction={handleAction} />
          )}
        </AnimatePresence>
        {!isOpen && <CopilotButton insight={insight} isOpen={isOpen} onClick={handleOpen} />}
      </div>
    </div>
  );
}

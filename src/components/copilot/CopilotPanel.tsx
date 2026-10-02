'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { X, Send } from 'lucide-react';
import type { CopilotMessage, CopilotAction as CopilotActionType } from './copilot.types';
import { CopilotAvatarMark } from './CopilotAvatarMark';
import { CopilotAction } from './CopilotAction';
import { ProposalCard } from './ProposalCard';
import { suggestedCopilotQuestions, suggestedCopilotTools } from '../../services/copilotChat';
import { cn } from '../../lib/cn';

interface CopilotPanelProps {
  messages: CopilotMessage[];
  onClose: () => void;
  onSend: (text: string) => void;
  onAction: (action: CopilotActionType) => void;
  onResolveProposal: (messageId: string, resolution: 'accepted' | 'dismissed') => void;
}

/**
 * A real conversation surface: the seeded insight (if any) opens it, then
 * free-text questions are answered by services/copilotChat — every
 * answer is grounded in the same finance numbers the rest of the app
 * shows, never a figure the chat invented for the reply (see
 * copilotChat.ts's own comment on that boundary). Three of those answers
 * come back as PROPOSALS instead of plain text (a drafted scope, a
 * suggested change-request classification, a drafted client nudge) —
 * those render as their own card with explicit Accept/Dismiss, never
 * auto-applied just because they were asked for.
 */
export function CopilotPanel({ messages, onClose, onSend, onAction, onResolveProposal }: CopilotPanelProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Optional-chained on scrollTo itself, not just the element — jsdom
    // (used by the component tests) doesn't implement it, and guarding
    // here is harmless in real browsers, which always have it.
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft('');
  }

  function handleToolClick(prompt: string) {
    // "Draft scope from: " needs pasted text after it — fill the input
    // and let the person finish it, rather than sending an incomplete
    // command. The other two tools need no extra input, so they send
    // immediately, same as a suggested question.
    if (prompt.endsWith(': ')) {
      setDraft(prompt);
      inputRef.current?.focus();
      return;
    }
    onSend(prompt);
  }

  return (
    <motion.div
      role="dialog"
      aria-label="CREW Copilot"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className="pointer-events-auto flex max-h-[75vh] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl shadow-ink-950/40"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <CopilotAvatarMark size={22} />
          <span className="text-[13px] font-medium text-bone-50">CREW Copilot</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close Copilot"
          className="rounded-full p-1 text-bone-200/70 hover:bg-white/10 hover:text-bone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-bone-200/70">
            Ask about a cash gap, a deposit, or when you'll get paid — Copilot answers from your actual project numbers.
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={cn('flex gap-2', message.role === 'user' && 'flex-row-reverse')}>
              {message.role === 'assistant' && <CopilotAvatarMark size={22} className="mt-1 shrink-0" />}
              <div className={cn('max-w-[85%] space-y-2', message.role === 'user' && 'flex flex-col items-end')}>
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                    message.role === 'assistant' ? 'bg-white/8 text-bone-100' : 'bg-gold-500 text-ink-950',
                  )}
                >
                  {message.text}
                </div>
                {message.role === 'assistant' && message.proposal && (
                  <ProposalCard
                    proposal={message.proposal}
                    status={message.proposalStatus ?? 'pending'}
                    onAccept={() => onResolveProposal(message.id, 'accepted')}
                    onDismiss={() => onResolveProposal(message.id, 'dismissed')}
                  />
                )}
                {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {message.actions.map((action, i) => (
                      <CopilotAction key={action.id} action={action} onSelect={onAction} variant={i === 0 ? 'primary' : 'secondary'} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 px-3 pb-3 pt-2.5">
        <div className="mb-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {suggestedCopilotTools().map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleToolClick(prompt)}
              className="shrink-0 whitespace-nowrap rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 text-xs font-medium text-gold-500 hover:bg-gold-500/20"
            >
              {prompt.trim()}
            </button>
          ))}
        </div>
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {suggestedCopilotQuestions().map((question) => (
            <button
              key={question}
              onClick={() => onSend(question)}
              className="shrink-0 whitespace-nowrap rounded-full bg-white/8 px-3 py-1.5 text-xs font-medium text-bone-200/80 hover:bg-white/15 hover:text-bone-50"
            >
              {question}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask Copilot…"
            aria-label="Ask Copilot"
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-bone-50 placeholder:text-bone-200/40 focus:border-gold-500/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink-950 transition-opacity disabled:opacity-30"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

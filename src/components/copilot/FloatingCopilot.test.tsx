import { describe, expect, beforeEach, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CopilotProvider } from './CopilotContext';
import { useProjectStore } from '../../store/projectStore';
import { getCopilotInsight } from '../../services/copilot';
import { formatNaira } from '../../lib/money';
import { FloatingCopilot } from './FloatingCopilot';

/** Computes the real insight the app itself would show right now, from
 * the store's actual state — so these tests assert against genuine app
 * behavior instead of a guessed headline that can silently drift. */
function currentRealInsight() {
  const { project, paymentStatus, invoiceApproved, derived } = useProjectStore.getState();
  const { cashGap, expectedProfit, gapDate } = derived();
  return getCopilotInsight({ route: 'dashboard', project, cashGap, expectedProfit, gapDate, paymentStatus, invoiceApproved });
}

describe('FloatingCopilot', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('is always reachable, regardless of whether there is a notable insight to flag', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    // Previously the whole control returned null whenever there was
    // nothing notable to surface, so Copilot was unreachable for a
    // free-text question unless something was already flagged. It's now
    // always rendered — this doesn't assert which state the demo project
    // happens to be in, only that the control exists regardless.
    expect(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i })).toBeInTheDocument();
  });

  it('seeds the conversation with the real current insight when opened', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    const insight = currentRealInsight();
    fireEvent.click(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i }));

    expect(screen.getByRole('dialog', { name: 'CREW Copilot' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(insight.headline.slice(0, 20), 'i'))).toBeInTheDocument();
  });

  it('answers a typed cash-gap question with the real figure, not a hardcoded one', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    const { cashGap } = useProjectStore.getState().derived();

    fireEvent.click(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i }));
    fireEvent.change(screen.getByLabelText('Ask Copilot'), { target: { value: "What's my cash gap?" } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    if (cashGap > 0) {
      // The seeded insight may already mention the same figure, so this
      // only needs at least one match, not a single unique one.
      expect(screen.getAllByText(new RegExp(formatNaira(cashGap), 'i')).length).toBeGreaterThan(0);
    } else {
      expect(screen.getByText(/No projected gap/i)).toBeInTheDocument();
    }
  });

  it('sends a suggested question chip on click and answers with the real profit figure', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    const { expectedProfit } = useProjectStore.getState().derived();

    fireEvent.click(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i }));
    fireEvent.click(screen.getByRole('button', { name: "How's my profit looking?" }));

    expect(screen.getAllByText(new RegExp(formatNaira(expectedProfit), 'i')).length).toBeGreaterThan(0);
  });

  it('agent tool: drafts a scope card from pasted text, applying it only once accepted', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i }));
    // The tool chip pre-fills the input rather than sending immediately —
    // it needs pasted text to work with.
    fireEvent.click(screen.getByRole('button', { name: 'Draft scope from:' }));
    const input = screen.getByLabelText('Ask Copilot');
    expect(input).toHaveValue('Draft scope from: ');

    fireEvent.change(input, { target: { value: 'Draft scope from: 4 TikTok videos, 1 Instagram reel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByText('4 videos — TikTok videos')).toBeInTheDocument();
    expect(screen.getByText('1 reel — Instagram reel')).toBeInTheDocument();

    // Not applied yet — proposing is not the same as doing. The
    // project's real scope still has its original quantities (3 TikToks),
    // not the drafted ones (4).
    expect(useProjectStore.getState().project.scope?.[0]?.quantity).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: 'Use this scope' }));

    const scope = useProjectStore.getState().project.scope;
    expect(scope).toHaveLength(2);
    expect(scope?.[0]).toMatchObject({ label: 'TikTok video', quantity: 4, unit: 'video', status: 'locked' });
    expect(screen.getByText('Applied to Scope')).toBeInTheDocument();
  });

  it('agent tool: proposes a change-request classification, applied only on accept', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Classify this change request' }));

    expect(screen.getByText('Suggested: Extra')).toBeInTheDocument();
    expect(useProjectStore.getState().project.changeRequests?.[0].classification).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Classify as extra' }));

    expect(useProjectStore.getState().project.changeRequests?.[0].classification).toBe('extra');
    expect(screen.getByText('Classification applied')).toBeInTheDocument();
  });

  it('agent tool: drafts a client nudge for review, grounded in the real pending change request', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft a client nudge' }));

    expect(screen.getByText(/One more TikTok video/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument();
  });

  it('agent tool: dismissing a proposal never applies it', () => {
    render(
      <CopilotProvider>
        <FloatingCopilot />
      </CopilotProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Ask Copilot|CREW Copilot/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Classify this change request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(useProjectStore.getState().project.changeRequests?.[0].classification).toBeNull();
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
  });
});

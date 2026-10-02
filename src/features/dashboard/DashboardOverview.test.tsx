import { describe, expect, beforeEach, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CopilotProvider } from '../../components/copilot/CopilotContext';
import { useProjectStore } from '../../store/projectStore';
import { DashboardOverview } from './DashboardOverview';

describe('DashboardOverview', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('renders the workspace summary and current project attention items', () => {
    render(
      <CopilotProvider>
        <DashboardOverview />
      </CopilotProvider>,
    );

    expect(screen.getByRole('heading', { name: /Good morning, Kemi/i })).toBeInTheDocument();
    expect(screen.getByText('₦324,500')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'DIV' && el.textContent === 'Lumo Skincare deal · Lumo Skincare')).toBeInTheDocument();
  });

  it('surfaces the pending change-request approval and other projects\u2019 payments due', () => {
    render(
      <CopilotProvider>
        <DashboardOverview />
      </CopilotProvider>,
    );

    // Kemi's deposit already covers her costs (see demoPersona.ts), so
    // there's no cash-gap item — the live attention item on her own deal
    // is the pending change-request approval, not a cash warning.
    expect(screen.getByText('One more TikTok video')).toBeInTheDocument();
    expect(screen.getByText('\u20a630,000 if extra')).toBeInTheDocument();
    expect(screen.getByText('Approval waiting')).toBeInTheDocument();

    // Dapo's wedding decor is awaiting_payment in demoData.ts — its
    // balance-due amount is computed, not hardcoded, from revenue and
    // depositPct via lib/finance.ts.
    expect(screen.getByText('Balance due')).toBeInTheDocument();
    expect(screen.getByText('\u20a6372,000')).toBeInTheDocument();

    // Only 2 items — below the 3-item threshold — so no toggle renders.
    expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
  });
});
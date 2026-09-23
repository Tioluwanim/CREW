import { describe, expect, beforeEach, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CopilotProvider } from '../../components/copilot/CopilotContext';
import { useProjectStore } from '../../store/projectStore';
import { DashboardOverview } from './DashboardOverview';

describe('DashboardOverview', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('renders the workspace summary and current project attention item', () => {
    render(
      <CopilotProvider>
        <DashboardOverview />
      </CopilotProvider>,
    );

    expect(screen.getByRole('heading', { name: /Good morning, Amara/i })).toBeInTheDocument();
    expect(screen.getByText('₦324,500')).toBeInTheDocument();
    expect(screen.getByText('Aso-ebi order')).toBeInTheDocument();
  });

  it('owns the attention context toggle locally', () => {
    render(
      <CopilotProvider>
        <DashboardOverview />
      </CopilotProvider>,
    );

    const toggle = screen.getByRole('button', { name: 'View all' });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/completed work and projects still awaiting payment/i)).toBeInTheDocument();
  });
});
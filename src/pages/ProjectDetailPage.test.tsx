import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { CopilotProvider } from '../components/copilot/CopilotContext';
import { useProjectStore } from '../store/projectStore';

function renderProjectPage() {
  return render(
    <MemoryRouter>
      <CopilotProvider>
        <ProjectDetailPage />
      </CopilotProvider>
    </MemoryRouter>,
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('renders the project name and headline figures', () => {
    renderProjectPage();
    expect(screen.getByRole('heading', { name: 'Aso-ebi order' })).toBeInTheDocument();
    expect(screen.getByText('₦480,000')).toBeInTheDocument();
  });

  it('moving the deposit slider updates the projected cash gap', () => {
    renderProjectPage();
    const slider = screen.getByRole('slider', { name: 'Deposit percentage' });

    // At the default 40% deposit there is a cash gap, so "No gap" isn't shown.
    expect(screen.queryByText('No gap')).not.toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '70' } });

    // 70% deposit on ₦480,000 = ₦336,000, which covers the ₦325,000 total costs.
    expect(screen.getByText('No gap')).toBeInTheDocument();
  });

  it('editing a cost amount updates the budget total', () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole('button', { name: 'Budget' }));

    const materialsInput = screen.getByLabelText('Materials amount');
    fireEvent.change(materialsInput, { target: { value: '230000' } });

    expect(screen.getByText('₦345,000')).toBeInTheDocument(); // 230k + 80k + 20k + 15k
  });
});

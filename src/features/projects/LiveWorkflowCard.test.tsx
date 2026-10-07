import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveWorkflowCard } from './LiveWorkflowCard';
import type { Project } from '../../types';

const base = { id: 'p1', name: 'Shoot', clientId: 'c', clientName: 'Z', craft: 'Photography', revenue: 1, depositPct: 40, costs: [], expectedPaymentDays: 14, status: 'active', createdAt: '', activity: [] } as Project;

describe('LiveWorkflowCard', () => {
  it('asks for a deliverable first and sends the add call', async () => {
    const run = vi.fn(async () => undefined);
    render(<LiveWorkflowCard project={{ ...base, stage: 'brief', deliverables: [] }} run={run} />);
    expect(screen.getByText(/Add what you will deliver/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark scope agreed' })).toBeNull();
    await userEvent.type(screen.getByPlaceholderText('e.g. 20 edited photos'), '10 photos');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('offers only the next step for each stage', () => {
    const d = [{ id: 'd1', title: 'Photos', status: 'delivered' }];
    const { rerender } = render(<LiveWorkflowCard project={{ ...base, stage: 'funded', deliverables: d }} run={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Start work' })).toBeTruthy();
    rerender(<LiveWorkflowCard project={{ ...base, stage: 'in_progress', deliverables: d }} run={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Send for client review' })).toBeTruthy();
    rerender(<LiveWorkflowCard project={{ ...base, stage: 'approved', deliverables: d }} run={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Release funds' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send balance invoice' })).toBeTruthy();
    rerender(<LiveWorkflowCard project={{ ...base, stage: 'in_review', deliverables: d }} run={vi.fn()} />);
    expect(screen.getByText(/Waiting for the client/)).toBeTruthy();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientProjectPage } from './ClientProjectPage';
import { useProjectStore } from '../store/projectStore';

function renderClientPage(path = '/pay/project-lumo-deal') {
  window.history.pushState({}, '', path);
  return render(<ClientProjectPage />);
}

describe('ClientProjectPage — no-signup client view', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('shows an empty state for a link that matches nothing in the demo dataset', () => {
    renderClientPage('/pay/does-not-exist');
    expect(screen.getByText("This link doesn't match a project in the demo dataset.")).toBeInTheDocument();
  });

  it('renders the scope card and lets the client approve or flag an item locally', () => {
    renderClientPage();

    const approveButton = screen.getByRole('button', { name: 'Approve TikTok video' });
    const flagButton = screen.getByRole('button', { name: 'Flag TikTok video' });

    expect(approveButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(approveButton);
    expect(approveButton).toHaveAttribute('aria-pressed', 'true');

    expect(flagButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(flagButton);
    expect(flagButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not show the change request until the creator has classified it', () => {
    renderClientPage();
    expect(screen.queryByText('Change request')).not.toBeInTheDocument();
  });

  it('lets the client approve a classified "extra" change request, updating the shared store', () => {
    useProjectStore.getState().classifyChangeRequest('cr-extra-tiktok', 'extra');
    renderClientPage();

    expect(screen.getByText(/classified as extra work/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(screen.getByText(/waiting on the creator/i)).toBeInTheDocument();
    expect(useProjectStore.getState().project.changeRequests?.[0].clientApproved).toBe(true);
  });

  it('lets the client reject a classified "extra" change request, with no price change', () => {
    useProjectStore.getState().classifyChangeRequest('cr-extra-tiktok', 'extra');
    renderClientPage();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(screen.getByText(/was rejected/)).toBeInTheDocument();
    expect(useProjectStore.getState().project.revenue).toBe(300_000);
  });

  it('walks the deposit then the balance through the "pay" action', () => {
    renderClientPage();

    expect(screen.getByRole('button', { name: /Pay deposit — ₦120,000/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pay deposit/ }));

    expect(useProjectStore.getState().project.milestones?.find((m) => m.id === 'ms-deposit')?.status).toBe('funded');
    expect(useProjectStore.getState().paymentStatus).toBe('pending'); // deposit alone doesn't verify the project

    expect(screen.getByRole('button', { name: /Pay balance — ₦180,000/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pay balance/ }));

    expect(useProjectStore.getState().project.milestones?.find((m) => m.id === 'ms-balance')?.status).toBe('funded');
    expect(useProjectStore.getState().paymentStatus).toBe('verified');
    expect(screen.getByText('All milestones paid.')).toBeInTheDocument();
  });
});

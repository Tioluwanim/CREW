import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectDetailPage } from './ProjectDetailPage';
import { CopilotProvider } from '../components/copilot/CopilotContext';
import { useProjectStore } from '../store/projectStore';

function renderProjectPage(path = '/app/projects/project-lumo-deal') {
  window.history.pushState({}, '', path);
  return render(
    <CopilotProvider>
      <ProjectDetailPage />
    </CopilotProvider>,
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('renders the hero (editable) project name and headline figures', () => {
    renderProjectPage();
    expect(screen.getByRole('heading', { name: 'Lumo Skincare deal' })).toBeInTheDocument();
    expect(screen.getByText('₦300,000')).toBeInTheDocument();
  });

  it('moving the deposit slider updates the projected cash gap', () => {
    renderProjectPage();
    const slider = screen.getByRole('slider', { name: 'Deposit percentage' });

    // Kemi's default 40% deposit (₦120,000) already covers her ₦65,000 in
    // creator-funded costs, so there's no gap at rest — this deal's story
    // is about scope, not cash timing (see demoPersona.ts). Drop the
    // deposit low enough to open a gap, then confirm raising it closes it.
    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.queryByText('No gap')).not.toBeInTheDocument();

    // 25% deposit on ₦300,000 = ₦75,000, which covers the ₦65,000 total costs.
    fireEvent.change(slider, { target: { value: '25' } });
    expect(screen.getByText('No gap')).toBeInTheDocument();
  });

  it('editing a cost amount updates the costs & profit total', () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole('button', { name: 'Costs & Profit' }));

    const propsInput = screen.getByLabelText('Props & wardrobe amount');
    fireEvent.change(propsInput, { target: { value: '30000' } });

    // Appears twice now that Costs & Profit are one merged tab: the cost
    // list's own total, and the profit breakdown's "Costs" line.
    expect(screen.getAllByText('₦85,000')).toHaveLength(2); // 40k editor + 15k promo + 30k props
    expect(screen.getAllByText('₦215,000').length).toBeGreaterThan(0); // profit: 300k revenue - 85k costs
  });

  it('renders a non-hero project in read-only mode, with no editable deposit slider', () => {
    renderProjectPage('/app/projects/project-ankara-set');
    expect(screen.getByRole('heading', { name: 'Ankara two-piece — Funke' })).toBeInTheDocument();
    expect(screen.getByText('Read-only in this demo')).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Deposit percentage' })).not.toBeInTheDocument();
  });

  it('shows an empty state for an id that matches nothing in the demo dataset', () => {
    renderProjectPage('/app/projects/does-not-exist');
    expect(screen.getByText("This project doesn't exist in the demo dataset.")).toBeInTheDocument();
  });

  it('Scope tab lists the locked deliverables and flags the pending change request', () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole('button', { name: 'Scope' }));

    expect(screen.getByText('3 videos — TikTok videos')).toBeInTheDocument();
    expect(screen.getByText('2 posts — Instagram posts')).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === 'BUTTON' && !!el.textContent?.includes('1 pending change not yet reflected here')),
    ).toBeInTheDocument();
  });

  it('classifying a change request as "included" resolves it with no price change and no approval step', () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole('button', { name: /^Changes/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Included — no charge' }));

    expect(screen.getByText(/already covered by the original scope/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'You approve' })).not.toBeInTheDocument();
    // Total unchanged — still the original ₦300,000, visible in the header stats.
    expect(screen.getByText('₦300,000')).toBeInTheDocument();
  });

  it('classifying as "extra" and getting both-sides approval updates revenue and appends the scope item', () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole('button', { name: /^Changes/ }));

    fireEvent.click(screen.getByRole('button', { name: /Extra — ₦30,000/ }));
    fireEvent.click(screen.getByRole('button', { name: 'You approve' }));
    // One-sided approval — total still unchanged.
    expect(screen.getByText('₦300,000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simulate client approval' }));

    // Both sides approved — header revenue stat updates.
    expect(screen.getByText('₦330,000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Scope' }));
    expect(screen.getByText(/1 video — TikTok video/)).toBeInTheDocument();
  });

  it('Payments tab walks the balance milestone through its status pipeline', () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }));

    // Deposit milestone is blocked until the invoice is sent; the balance
    // milestone isn't gated on the invoice the same way.
    expect(screen.getByRole('button', { name: 'Send invoice first' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Approve & send' }));

    // Deposit is now unblocked too, so both milestones briefly show
    // "Advance to Funded" — the balance milestone renders second.
    const advanceToFunded = screen.getAllByRole('button', { name: 'Advance to Funded' });
    expect(advanceToFunded).toHaveLength(2);
    fireEvent.click(advanceToFunded[1]);

    fireEvent.click(screen.getByRole('button', { name: 'Advance to In progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance to In review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance to Approved' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance to Released' }));

    expect(screen.getByText('Released to you.')).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InteractiveDemo } from './LandingPage';

// Covers the landing page's hero interaction post-pivot (see Instructions
// section 2/4): a client change-request has to be classified as included
// or extra, then approved by both sides, before it affects price — this
// is the "two-tap decision instead of an argument" the pivot is about, so
// it needs a real test, not just visual review.

describe('LandingPage InteractiveDemo — change-request flow', () => {
  it('starts unclassified, at the original ₦300,000 total, with no charge visible', () => {
    render(<InteractiveDemo />);
    expect(screen.getByText('₦300,000')).toBeInTheDocument();
    expect(screen.queryByText('₦330,000')).not.toBeInTheDocument();
  });

  it('classifying the ask as "included" leaves price unchanged and needs no approval', async () => {
    const user = userEvent.setup();
    render(<InteractiveDemo />);

    await user.click(screen.getByRole('button', { name: 'Included — no charge' }));

    expect(screen.getByText(/already covered by the original scope/i)).toBeInTheDocument();
    expect(screen.getByText('₦300,000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'You approve' })).not.toBeInTheDocument();
  });

  it('classifying as "extra" requires BOTH sides to approve before the total updates', async () => {
    const user = userEvent.setup();
    render(<InteractiveDemo />);

    await user.click(screen.getByRole('button', { name: /Extra — ₦30,000/ }));

    // Classified, but not yet approved by either side — total unchanged.
    expect(screen.getByText('₦300,000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'You approve' }));
    // Only one side approved — still unchanged.
    expect(screen.getByText('₦300,000')).toBeInTheDocument();
    expect(screen.queryByText('₦330,000')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lumo approves' }));
    // Both sides approved — the total now reflects the extra ₦30,000.
    expect(screen.getByText('₦330,000')).toBeInTheDocument();
    expect(screen.getByText(/Both sides agreed/i)).toBeInTheDocument();
  });
});

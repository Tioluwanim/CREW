import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingPage } from './OnboardingPage';

function renderOnboarding() {
  return render(<OnboardingPage />);
}

describe('OnboardingPage', () => {
  it('walks through all five steps to the finish screen', () => {
    renderOnboarding();

    expect(screen.getByText('What do you create?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fashion'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('How long have you been doing this?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('How long have you been doing this?'), { target: { value: '3–7 years' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('How do you usually charge?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Per project'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('What deposit do you usually request?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Typical cash available before a new project')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(screen.getByText('Your workspace is ready.')).toBeInTheDocument();
  });

  it('disables Continue until the current step has an answer', () => {
    renderOnboarding();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(screen.getByText('Photography'));
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  it('requires an experience answer before continuing past step 2', () => {
    renderOnboarding();
    fireEvent.click(screen.getByText('Design'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('How long have you been doing this?'), { target: { value: 'Just starting out' } });
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  it('requires a custom deposit value before continuing when Custom is selected', () => {
    renderOnboarding();
    fireEvent.click(screen.getByText('Design'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('How long have you been doing this?'), { target: { value: '1–3 years' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByText('Retainer'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Deposit %'), { target: { value: '35' } });
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  function completeOnboarding(craft: string, experience: string) {
    fireEvent.click(screen.getByText(craft));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('How long have you been doing this?'), { target: { value: experience } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByText('Per project'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  }

  it('shows a starter scope template and rate range matched to the chosen craft, never a tier or score', () => {
    renderOnboarding();
    completeOnboarding('Content Creator', '1–3 years');

    expect(screen.getByText('3 videos — TikTok videos')).toBeInTheDocument();
    expect(screen.getByText('2 posts — Instagram posts')).toBeInTheDocument();
    expect(screen.getByText(/Suggested rate/)).toBeInTheDocument();
    expect(screen.getByText(/A starting point to edit, not a rating/)).toBeInTheDocument();

    // Never a labeled tier/score VALUE anywhere on the finish screen —
    // the word "score" legitimately appears once, in the disclaimer
    // sentence that explicitly says there isn't one.
    expect(screen.queryByText(/tier\s*:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score\s*:/i)).not.toBeInTheDocument();
  });

  it('scales the suggested rate by self-declared experience, for the same craft', () => {
    const { unmount } = renderOnboarding();
    completeOnboarding('Content Creator', 'Just starting out');
    const beginnerRate = screen.getByText(/per project$/).textContent;
    unmount();

    renderOnboarding();
    completeOnboarding('Content Creator', '7+ years');
    const experiencedRate = screen.getByText(/per project$/).textContent;

    expect(beginnerRate).not.toBe(experiencedRate);
  });
});

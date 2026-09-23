import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingPage } from './OnboardingPage';

function renderOnboarding() {
  return render(<OnboardingPage />);
}

describe('OnboardingPage', () => {
  it('walks through all four steps to the finish screen', () => {
    renderOnboarding();

    expect(screen.getByText('What do you create?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fashion'));
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

  it('requires a custom deposit value before continuing when Custom is selected', () => {
    renderOnboarding();
    fireEvent.click(screen.getByText('Design'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByText('Retainer'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Deposit %'), { target: { value: '35' } });
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });
});

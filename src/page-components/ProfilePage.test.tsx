import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfilePage } from './ProfilePage';
import { kemiProfile } from '../data/demoData';

describe('ProfilePage', () => {
  it('renders the business profile and the verified badge row, computed from the profile', () => {
    render(<ProfilePage />);

    expect(screen.getByRole('heading', { name: kemiProfile.businessName })).toBeInTheDocument();
    expect(screen.getAllByText(`${kemiProfile.projectsCompleted}`).length).toBeGreaterThan(0);
    expect(screen.getByText('On-time payment rate')).toBeInTheDocument();
    expect(screen.getByText('Repeat clients')).toBeInTheDocument();
  });

  it('never renders a star-rating UI — explicitly decided against', () => {
    render(<ProfilePage />);
    expect(screen.queryByText('★')).not.toBeInTheDocument();
    expect(document.querySelector('[class*="star" i]')).not.toBeInTheDocument();
  });
});

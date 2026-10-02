import { describe, it, expect } from 'vitest';
import { computeVerifiedBadges } from './computeVerifiedBadges';
import { kemiProfile } from '../../data/demoData';

describe('computeVerifiedBadges', () => {
  it('returns projects completed, on-time rate, and repeat clients — nothing else', () => {
    const badges = computeVerifiedBadges(kemiProfile);
    expect(badges.map((b) => b.id)).toEqual(['projects-completed', 'on-time-rate', 'repeat-clients']);
  });

  it('formats values straight from the profile, with no thresholding or judgment applied', () => {
    const badges = computeVerifiedBadges({ ...kemiProfile, projectsCompleted: 5, onTimePaymentRate: 0.5, repeatClientCount: 2 });
    expect(badges.find((b) => b.id === 'projects-completed')?.value).toBe('5');
    expect(badges.find((b) => b.id === 'on-time-rate')?.value).toBe('50%');
    expect(badges.find((b) => b.id === 'repeat-clients')?.value).toBe('2');
  });
});

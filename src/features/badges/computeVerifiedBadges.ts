import type { CreativeProfile } from '../../types';

/**
 * Each badge is a fact, not a judgment: a count or a rate, computed from
 * the creator's own history, with no pass/fail threshold attached. This
 * is a stand-in for a backend aggregation endpoint (there's no backend
 * yet — see the Intelligence Layer build plan) — but the SHAPE is meant
 * to be realistic: the frontend only ever renders what this function
 * returns, it never computes a badge value inline wherever it displays
 * one. No star rating, no 1-5 scale, no pass/fail — explicitly decided
 * against (see the frontend rebuild brief, Stage G).
 */
export interface VerifiedBadge {
  id: string;
  label: string;
  value: string;
}

export function computeVerifiedBadges(profile: CreativeProfile): VerifiedBadge[] {
  return [
    { id: 'projects-completed', label: 'Projects completed', value: `${profile.projectsCompleted}` },
    { id: 'on-time-rate', label: 'On-time payment rate', value: `${Math.round(profile.onTimePaymentRate * 100)}%` },
    { id: 'repeat-clients', label: 'Repeat clients', value: `${profile.repeatClientCount}` },
  ];
}

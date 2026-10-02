'use client';

import { BadgeCheck } from 'lucide-react';
import { computeVerifiedBadges } from './computeVerifiedBadges';
import type { CreativeProfile } from '../../types';

/**
 * A small, display-only badge row — not a star rating (explicitly
 * decided against). Each badge is a plain fact from computeVerifiedBadges;
 * this component has no logic of its own for deciding what counts as
 * "good," it just renders what it's given.
 */
export function VerifiedBadgeRow({ profile }: { profile: CreativeProfile }) {
  const badges = computeVerifiedBadges(profile);

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <div key={badge.id} className="flex items-center gap-1.5 rounded-full border border-verified-600/20 bg-verified-100/60 px-3 py-1.5">
          <BadgeCheck size={13} className="shrink-0 text-verified-600" aria-hidden="true" />
          <span className="num text-xs font-medium text-verified-600">{badge.value}</span>
          <span className="text-xs text-ink-700">{badge.label}</span>
        </div>
      ))}
    </div>
  );
}

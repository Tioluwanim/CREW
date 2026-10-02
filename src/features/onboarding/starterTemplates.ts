import { formatNaira } from '../../lib/money';
import type { OnboardingAnswers } from './types';

/**
 * Picks a starter scope-card template and a suggested rate range from the
 * self-declared craft + experience — nothing here is a tier, a score, or
 * a judgment. It's a lookup, not an assessment: two creators who pick the
 * same craft and experience answer get the exact same starting numbers,
 * and nothing about this is ever shown back as a rating.
 *
 * All amounts here are plain naira, matching the rest of the frontend
 * (ProjectCost.amount, Project.revenue, etc. — see demoPersona.ts). This
 * frontend never works in kobo; only the Python Intelligence Layer does.
 */
export interface StarterTemplate {
  scopeItems: { label: string; quantity: number; unit: string }[];
  rateRangeLabel: string;
}

interface CraftDefaults {
  scopeItems: { label: string; quantity: number; unit: string }[];
  baseLowNaira: number;
  baseHighNaira: number;
}

const CRAFT_DEFAULTS: Record<string, CraftDefaults> = {
  'Content Creator': {
    scopeItems: [
      { label: 'TikTok video', quantity: 3, unit: 'video' },
      { label: 'Instagram post', quantity: 2, unit: 'post' },
    ],
    baseLowNaira: 150_000,
    baseHighNaira: 300_000,
  },
  Fashion: {
    scopeItems: [
      { label: 'outfit', quantity: 1, unit: 'outfit' },
      { label: 'fitting session', quantity: 1, unit: 'session' },
    ],
    baseLowNaira: 200_000,
    baseHighNaira: 450_000,
  },
  Photography: {
    scopeItems: [
      { label: 'shoot', quantity: 1, unit: 'session' },
      { label: 'edited photo', quantity: 20, unit: 'photo' },
    ],
    baseLowNaira: 120_000,
    baseHighNaira: 280_000,
  },
  Videography: {
    scopeItems: [
      { label: 'edited video', quantity: 1, unit: 'video' },
      { label: 'raw footage day', quantity: 1, unit: 'day' },
    ],
    baseLowNaira: 250_000,
    baseHighNaira: 600_000,
  },
  Design: {
    scopeItems: [
      { label: 'design concept', quantity: 2, unit: 'concept' },
      { label: 'revision round', quantity: 2, unit: 'round' },
    ],
    baseLowNaira: 100_000,
    baseHighNaira: 250_000,
  },
  Beauty: {
    scopeItems: [{ label: 'session', quantity: 1, unit: 'session' }],
    baseLowNaira: 80_000,
    baseHighNaira: 180_000,
  },
  Music: {
    scopeItems: [
      { label: 'track', quantity: 1, unit: 'track' },
      { label: 'revision round', quantity: 2, unit: 'round' },
    ],
    baseLowNaira: 150_000,
    baseHighNaira: 350_000,
  },
  Events: {
    scopeItems: [
      { label: 'event day', quantity: 1, unit: 'day' },
      { label: 'planning session', quantity: 2, unit: 'session' },
    ],
    baseLowNaira: 300_000,
    baseHighNaira: 800_000,
  },
  Other: {
    scopeItems: [{ label: 'deliverable', quantity: 1, unit: 'item' }],
    baseLowNaira: 100_000,
    baseHighNaira: 250_000,
  },
};

// Multiplies the craft's base rate range by self-declared experience.
// Purely a number scale, never surfaced as a label — see the module
// comment above.
const EXPERIENCE_MULTIPLIER: Record<string, number> = {
  'Just starting out': 0.7,
  '1–3 years': 1,
  '3–7 years': 1.5,
  '7+ years': 2.2,
};

export function getStarterTemplate(answers: Pick<OnboardingAnswers, 'craft' | 'experience'>): StarterTemplate | null {
  if (!answers.craft) return null;
  const defaults = CRAFT_DEFAULTS[answers.craft] ?? CRAFT_DEFAULTS.Other;
  const multiplier = answers.experience ? (EXPERIENCE_MULTIPLIER[answers.experience] ?? 1) : 1;

  const low = Math.round((defaults.baseLowNaira * multiplier) / 1000) * 1000;
  const high = Math.round((defaults.baseHighNaira * multiplier) / 1000) * 1000;

  return {
    scopeItems: defaults.scopeItems,
    rateRangeLabel: `${formatNaira(low)}\u2013${formatNaira(high)} per project`,
  };
}

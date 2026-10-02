export interface OnboardingAnswers {
  craft: string | null;
  experience: string | null;
  chargeStyle: string | null;
  typicalDeposit: number | 'custom' | null;
  customDeposit: string;
  startingCash: string;
}

export const CRAFTS = ['Content Creator', 'Fashion', 'Photography', 'Videography', 'Design', 'Beauty', 'Music', 'Events', 'Other'] as const;

/**
 * Self-declared, not inferred from an uploaded CV — judging experience
 * from document wording or formatting risks penalizing a skilled creator
 * with a less polished document, and self-declaration is both simpler to
 * build and more equitable. Used only to pick starter numbers on the
 * finish screen (see starterTemplates.ts) — never shown back as a tier,
 * score, or label anywhere in the product.
 */
export const EXPERIENCE_LEVELS = ['Just starting out', '1–3 years', '3–7 years', '7+ years'] as const;

export const CHARGE_STYLES = ['Per project', 'Per item', 'Hourly', 'Retainer', 'Mixed'] as const;
export const DEPOSIT_OPTIONS = [0, 25, 50, 60, 'custom'] as const;

export const initialAnswers: OnboardingAnswers = {
  craft: null,
  experience: null,
  chargeStyle: null,
  typicalDeposit: null,
  customDeposit: '',
  startingCash: '',
};

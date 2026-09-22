export interface OnboardingAnswers {
  craft: string | null;
  chargeStyle: string | null;
  typicalDeposit: number | 'custom' | null;
  customDeposit: string;
  startingCash: string;
}

export const CRAFTS = ['Fashion', 'Photography', 'Videography', 'Design', 'Beauty', 'Music', 'Events', 'Other'] as const;
export const CHARGE_STYLES = ['Per project', 'Per item', 'Hourly', 'Retainer', 'Mixed'] as const;
export const DEPOSIT_OPTIONS = [0, 25, 50, 60, 'custom'] as const;

export const initialAnswers: OnboardingAnswers = {
  craft: null,
  chargeStyle: null,
  typicalDeposit: null,
  customDeposit: '',
  startingCash: '',
};

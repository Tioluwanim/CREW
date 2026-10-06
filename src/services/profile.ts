import type { CreativeProfile } from '../types';
import { apiJson } from '../lib/apiClient';

export function getProfile(): Promise<CreativeProfile> {
  return apiJson<CreativeProfile>('/profile');
}

export interface ProfilePatch {
  businessName?: string;
  craft?: string;
  location?: string;
  ownerName?: string;
  typicalDepositPct?: number;
  /** Whole naira. */
  startingCash?: number;
}

export function patchProfile(patch: ProfilePatch): Promise<CreativeProfile> {
  return apiJson<CreativeProfile>('/profile', { method: 'PATCH', body: patch });
}

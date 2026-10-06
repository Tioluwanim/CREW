import { apiJson } from '../lib/apiClient';

export interface ProviderCapabilities {
  checkout: boolean;
  virtualAccounts: boolean;
  transferInstructions: boolean;
  payouts: boolean;
  statement: boolean;
  accountNameLookup: boolean;
  webhooks: boolean;
  amountUnit: string;
}

export interface ProvidersInfo {
  /** Provider that handles new client payments. */
  collections: string;
  /** Provider that pays released money out to the creator. */
  payouts: string;
  providers: Record<string, ProviderCapabilities>;
}

export interface PayoutAccount {
  bankCode: string | null;
  /** Masked by the backend, e.g. ******1234. */
  accountNumber: string | null;
  accountName: string | null;
  /** True only when the payout provider looked the name up at the bank. */
  verified: boolean;
}

export interface VirtualAccount {
  id: string;
  provider: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  status: string;
  expectedAmount: number | null;
  expiresAt: string | null;
}

export const getProviders = () => apiJson<ProvidersInfo>('/payments/providers');

export const getPayoutAccount = () => apiJson<PayoutAccount>('/profile/payout-account');

export const savePayoutAccount = (input: { bankCode: string; accountNumber: string; accountName: string }) =>
  apiJson<PayoutAccount>('/profile/payout-account', { method: 'PUT', body: input });

export const getVirtualAccounts = (projectId: string) =>
  apiJson<VirtualAccount[]>(`/projects/${encodeURIComponent(projectId)}/virtual-account`);

/** Repeat calls return the same open account. */
export const openVirtualAccount = (projectId: string) =>
  apiJson<VirtualAccount>(`/projects/${encodeURIComponent(projectId)}/virtual-account`, { method: 'POST' });

import { apiJson, newIdempotencyKey } from '../lib/apiClient';

// The no-signup client link (backend /share/{token}). Clients never see costs or margin.

export interface SharedDeliverable { id: string; title: string; description: string; status: string; evidenceUrl: string | null }
export interface SharedChange { id: string; title: string; description: string; amount: number; status: string }
export interface SharedInvoice { id: string; amount: number; status: string; kind: string; dueDate: string; depositPct: number }
export interface SharedView {
  project: { name: string; creator: string | null; stage: string; price: number; depositPct: number; revisionsIncluded: number; revisionsUsed: number };
  deliverables: SharedDeliverable[];
  milestones: { id: string; title: string; amount: number; funded: number; status: string }[];
  changeRequests: SharedChange[];
  invoices: SharedInvoice[];
  paid: number;
  outstanding: number;
  timeline: { label: string; timestamp: string; actor: string }[];
}
export interface SharedPayment {
  reference: string;
  amount: number;
  provider: string;
  method: string;
  checkoutUrl: string | null;
  instructions: string | null;
  virtualAccount: { accountNumber: string; accountName: string; bankName: string } | null;
  note: string;
}
export type PayMethod = 'checkout' | 'virtual_account' | 'transfer';

const base = (token: string) => `/share/${encodeURIComponent(token)}`;

export const getSharedProject = (token: string) => apiJson<SharedView>(base(token));
export const agreeToScope = (token: string) => apiJson<{ stage: string }>(`${base(token)}/agree`, { method: 'POST' });
export const approveDelivery = (token: string, deliverableId?: string) =>
  apiJson<{ stage: string }>(`${base(token)}/approve`, { method: 'POST', body: { deliverableId: deliverableId ?? null } });
export const requestRevision = (token: string, deliverableId: string, note: string) =>
  apiJson<{ stage: string; revision: number; withinScope: boolean }>(`${base(token)}/revision`, { method: 'POST', body: { deliverableId, note } });
export const decideChange = (token: string, changeId: string, decision: 'accept' | 'decline') =>
  apiJson<SharedChange>(`${base(token)}/change-requests/${changeId}/${decision}`, { method: 'POST' });
export const startPayment = (token: string, input: { invoiceId?: string; method: PayMethod; amount?: number }, key: string = newIdempotencyKey()) =>
  apiJson<SharedPayment>(`${base(token)}/pay`, { method: 'POST', idempotencyKey: key, body: input });
export const verifyPayment = (token: string, reference: string) =>
  apiJson<{ paymentReference: string; status: string }>(`${base(token)}/pay/${encodeURIComponent(reference)}/verify`, { method: 'POST' });

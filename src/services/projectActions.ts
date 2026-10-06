import { apiJson, newIdempotencyKey } from '../lib/apiClient';
import { adaptProject } from './adapt';
import type { Project } from '../types';

// Write-through calls for the project screens in live mode. Every function returns nothing
// meaningful on purpose: the caller re-reads the project with refreshProject() so the screen
// always shows what the backend actually holds (and a rejected edit snaps back).

export interface BackendInvoice {
  id: string;
  projectId: string;
  amount: number;
  status: string;
  kind: string;
  paymentLink: string;
}

export function saveDeposit(projectId: string, depositPct: number): Promise<unknown> {
  return apiJson(`/projects/${projectId}`, { method: 'PATCH', body: { depositPct } });
}

export function saveCostAmount(projectId: string, costId: string, amount: number): Promise<unknown> {
  return apiJson(`/projects/${projectId}/costs/${costId}`, { method: 'PATCH', body: { amount } });
}

export function proposeChange(projectId: string, input: { title: string; amount: number; description?: string }): Promise<unknown> {
  return apiJson(`/projects/${projectId}/change-requests`, { method: 'POST', body: input });
}

export function listInvoices(projectId: string): Promise<BackendInvoice[]> {
  return apiJson<BackendInvoice[]>(`/projects/${projectId}/invoices`);
}

/** Creates the deposit invoice (once) and sends it. Safe to retry: the key de-duplicates the create. */
export async function approveAndSendInvoice(projectId: string, key: string = newIdempotencyKey()): Promise<BackendInvoice> {
  const existing = (await listInvoices(projectId)).find((i) => i.kind === 'deposit' && i.status !== 'paid');
  const invoice =
    existing ??
    (await apiJson<BackendInvoice>(`/projects/${projectId}/invoices`, { method: 'POST', idempotencyKey: key, body: { kind: 'deposit' } }));
  if (invoice.status === 'sent') return invoice;
  return apiJson<BackendInvoice>(`/invoices/${invoice.id}/send`, { method: 'POST' });
}

export function advanceStage(projectId: string, to: 'agreed' | 'in_progress' | 'in_review' | 'closed'): Promise<unknown> {
  return apiJson(`/projects/${projectId}/transition`, { method: 'POST', body: { to } });
}

export function releaseFunds(projectId: string): Promise<unknown> {
  return apiJson(`/projects/${projectId}/release`, { method: 'POST' });
}

/**
 * Sandbox only: pays the outstanding balance through the same share-link payment path a client
 * would use, so the demo exercises the real verification code. Rejected by the backend when a
 * real payment provider is configured.
 */
export async function simulateSandboxPayment(projectId: string): Promise<void> {
  const link = await apiJson<{ token: string }>(`/projects/${projectId}/share-link`, { method: 'POST' });
  const invoices = await listInvoices(projectId);
  const target = invoices.find((i) => i.status === 'sent') ?? invoices[0];
  const pay = await apiJson<{ reference: string }>(`/share/${link.token}/pay`, {
    method: 'POST',
    idempotencyKey: newIdempotencyKey(),
    body: { invoiceId: target?.id, method: 'checkout' },
  });
  await apiJson(`/share/${link.token}/pay/${pay.reference}/verify`, { method: 'POST' });
}

export async function fetchProject(projectId: string): Promise<Project> {
  return adaptProject(await apiJson(`/projects/${projectId}`));
}

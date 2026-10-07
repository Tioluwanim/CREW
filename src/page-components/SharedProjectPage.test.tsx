import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SharedProjectPage } from './SharedProjectPage';

const view = (over: Record<string, unknown> = {}) => ({
  project: { name: 'Brand shoot', creator: 'Kemi Studio', stage: 'brief', price: 100000, depositPct: 40, revisionsIncluded: 2, revisionsUsed: 0 },
  deliverables: [{ id: 'd1', title: '20 photos', description: '', status: 'pending', evidenceUrl: null }],
  milestones: [], changeRequests: [{ id: 'c1', title: 'Extra reel', description: '', amount: 15000, status: 'proposed' }],
  invoices: [{ id: 'i1', amount: 40000, status: 'sent', kind: 'deposit', dueDate: '2026-10-10', depositPct: 40 }],
  paid: 0, outstanding: 100000, timeline: [], ...over,
});
const res = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe('SharedProjectPage', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the project and lets the client accept a change request', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/change-requests/c1/accept')) return res({ id: 'c1', status: 'accepted' });
      return res(view());
    });
    render(<SharedProjectPage token="tok" />);
    expect(await screen.findByText('Brand shoot')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u) === '/api/share/tok/change-requests/c1/accept')).toBe(true));
  });

  it('starts a payment with the invoice and shows bank-transfer details', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/pay')) return res({ reference: 'r1', amount: 40000, provider: 'sandbox', method: 'virtual_account', checkoutUrl: null, instructions: null, note: 'Sandbox - no real money moves.', virtualAccount: { accountNumber: '0123456789', accountName: 'CREW / Brand shoot', bankName: 'Sandbox Bank' } }, 201);
      return res(view());
    });
    render(<SharedProjectPage token="tok" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pay by bank transfer' }));
    expect(await screen.findByText('0123456789')).toBeTruthy();
    expect(screen.getByText(/no real money moves/i)).toBeTruthy();
    const payCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/pay'))!;
    expect(JSON.parse((payCall[1] as RequestInit).body as string)).toEqual({ invoiceId: 'i1', method: 'virtual_account' });
  });

  it('shows the backend message for a dead link', async () => {
    fetchMock.mockResolvedValue(res({ error: 'This link is no longer valid' }, 404));
    render(<SharedProjectPage token="gone" />);
    expect(await screen.findByText('This link is no longer valid')).toBeTruthy();
  });
});

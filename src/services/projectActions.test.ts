import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approveAndSendInvoice, proposeChange, saveCostAmount, saveDeposit } from './projectActions';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('projectActions', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());
  const call = (i: number) => { const [url, init] = fetchMock.mock.calls[i]; return { url: url as string, method: (init as RequestInit).method, body: JSON.parse(((init as RequestInit).body as string) ?? 'null') }; };

  it('saves the deposit and a cost with PATCH', async () => {
    fetchMock.mockImplementation(async () => json({}));
    await saveDeposit('p1', 50);
    await saveCostAmount('p1', 'k1', 12000);
    expect(call(0)).toEqual({ url: '/api/projects/p1', method: 'PATCH', body: { depositPct: 50 } });
    expect(call(1)).toEqual({ url: '/api/projects/p1/costs/k1', method: 'PATCH', body: { amount: 12000 } });
  });

  it('proposes a priced change request', async () => {
    fetchMock.mockImplementation(async () => json({}, 201));
    await proposeChange('p1', { title: 'Extra reel', amount: 15000 });
    expect(call(0)).toMatchObject({ url: '/api/projects/p1/change-requests', method: 'POST', body: { title: 'Extra reel', amount: 15000 } });
  });

  it('creates then sends the deposit invoice when none exists', async () => {
    fetchMock
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({ id: 'i1', status: 'draft', kind: 'deposit' }, 201))
      .mockResolvedValueOnce(json({ id: 'i1', status: 'sent', kind: 'deposit' }));
    const sent = await approveAndSendInvoice('p1', 'key-1');
    expect(sent.status).toBe('sent');
    expect(call(1)).toMatchObject({ url: '/api/projects/p1/invoices', method: 'POST', body: { kind: 'deposit' } });
    expect(call(2).url).toBe('/api/invoices/i1/send');
  });

  it('reuses an existing draft invoice instead of creating a second one', async () => {
    fetchMock
      .mockResolvedValueOnce(json([{ id: 'i9', status: 'draft', kind: 'deposit' }]))
      .mockResolvedValueOnce(json({ id: 'i9', status: 'sent', kind: 'deposit' }));
    await approveAndSendInvoice('p1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(call(1).url).toBe('/api/invoices/i9/send');
  });
});

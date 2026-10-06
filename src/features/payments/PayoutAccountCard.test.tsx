import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PayoutAccountCard } from './PayoutAccountCard';

const providers = (payouts: string, lookup: boolean) => ({
  collections: payouts,
  payouts,
  providers: { [payouts]: { checkout: true, virtualAccounts: true, transferInstructions: true, payouts: true, statement: true, accountNameLookup: lookup, webhooks: true, amountUnit: 'kobo' } },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockApi(opts: { payouts?: string; lookup?: boolean; account?: unknown; putResult?: Response }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/payments/providers')) return json(providers(opts.payouts ?? 'sandbox', opts.lookup ?? true));
    if (url.endsWith('/profile/payout-account') && init?.method === 'PUT') return opts.putResult ?? json({});
    if (url.endsWith('/profile/payout-account')) return json(opts.account ?? { bankCode: null, accountNumber: null, accountName: null, verified: false });
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('PayoutAccountCard', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('says plainly that the sandbox moves no real money', async () => {
    mockApi({ payouts: 'sandbox' });
    render(<PayoutAccountCard />);
    expect(await screen.findByText('Payouts via Sandbox')).toBeInTheDocument();
    expect(screen.getByText(/nothing here moves real money yet/i)).toBeInTheDocument();
  });

  it('links an Ecobank account (default bank) and shows the masked, bank-confirmed result', async () => {
    const fetchMock = mockApi({
      lookup: true,
      putResult: json({ bankCode: '050', accountNumber: '******1234', accountName: 'AMARA OBI', verified: true }),
    });
    render(<PayoutAccountCard />);
    const number = await screen.findByLabelText(/^Account number/);
    expect(screen.getByRole('combobox')).toHaveValue('050');
    const link = screen.getByRole('button', { name: 'Link account' });
    expect(link).toBeDisabled();
    await userEvent.type(number, '12345');
    expect(screen.getByText('Account numbers are 10 digits.')).toBeInTheDocument();
    await userEvent.type(number, '67890');
    await userEvent.type(screen.getByLabelText(/^Account name/), 'Amara Obi');
    await userEvent.click(link);
    expect(await screen.findByText('AMARA OBI')).toBeInTheDocument();
    expect(screen.getByText('Name confirmed by the bank')).toBeInTheDocument();
    expect(screen.getByText(/Ecobank Nigeria · \*{6}1234/)).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(JSON.parse(put[1]!.body as string)).toEqual({ bankCode: '050', accountNumber: '1234567890', accountName: 'Amara Obi' });
  });

  it('is honest when the provider cannot confirm the name', async () => {
    mockApi({
      payouts: 'ecobank',
      lookup: false,
      account: { bankCode: '058', accountNumber: '******9999', accountName: 'Kemi A', verified: false },
    });
    render(<PayoutAccountCard />);
    expect(await screen.findByText('Name as you typed it, not confirmed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change account' }));
    expect(screen.getByText(/cannot confirm it for you/i)).toBeInTheDocument();
  });

  it('shows the backend error when saving fails', async () => {
    mockApi({ putResult: json({ error: 'Account not found at the bank' }, 502) });
    render(<PayoutAccountCard />);
    await userEvent.type(await screen.findByLabelText(/^Account number/), '1234567890');
    await userEvent.type(screen.getByLabelText(/^Account name/), 'Someone');
    await userEvent.click(screen.getByRole('button', { name: 'Link account' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Account not found at the bank'));
  });
});

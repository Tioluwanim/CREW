'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Landmark } from 'lucide-react';
import { Button, Card, Pill } from '../../components/ui/primitives';
import { getPayoutAccount, getProviders, savePayoutAccount, type PayoutAccount, type ProvidersInfo } from '../../services/payments';
import { BANKS, ECOBANK_CODE, bankName } from './banks';

const inputClass =
  'w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2.5 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900';

function providerLabel(name: string): string {
  return name === 'sandbox' ? 'Sandbox' : name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Where released project money is paid out. Talks to GET/PUT /profile/payout-account.
 * What the card says about "real" or "sandbox" comes from the backend's active payout provider, so it never
 * claims a live bank connection that isn't there.
 */
export function PayoutAccountCard() {
  const [providers, setProviders] = useState<ProvidersInfo | null>(null);
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [bankCode, setBankCode] = useState<string>(ECOBANK_CODE);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getProviders(), getPayoutAccount()])
      .then(([p, a]) => {
        if (!active) return;
        setProviders(p);
        setAccount(a);
        setEditing(!a.accountNumber);
      })
      .catch((e: unknown) => active && setLoadError(e instanceof Error ? e.message : 'Could not load payout settings'));
    return () => {
      active = false;
    };
  }, []);

  const payoutProvider = providers?.payouts ?? '';
  const lookup = providers?.providers[payoutProvider]?.accountNameLookup ?? false;
  const isSandbox = payoutProvider === 'sandbox';
  const numberOk = /^\d{10}$/.test(accountNumber);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      setAccount(await savePayoutAccount({ bankCode, accountNumber, accountName: accountName.trim() }));
      setEditing(false);
      setAccountNumber('');
      setAccountName('');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save this account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <Landmark size={16} strokeWidth={2} /> Payout account
          </h2>
          <p className="mt-1 text-xs text-ink-500">Where CREW sends your money once a client approves the work.</p>
        </div>
        {providers && <Pill tone={isSandbox ? 'default' : 'verified'}>Payouts via {providerLabel(payoutProvider)}</Pill>}
      </div>

      {providers && isSandbox && (
        <p className="mt-3 rounded-lg bg-ink-900/[0.04] px-3 py-2 text-xs text-ink-600">
          This workspace is on the payment sandbox: nothing here moves real money yet. Your account is saved so payouts work the day a live Ecobank connection is switched on.
        </p>
      )}
      {loadError && (
        <p role="alert" className="mt-3 text-sm text-thread-600">
          {loadError}
        </p>
      )}

      {account?.accountNumber && !editing && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-900/10 p-4">
          <div>
            <div className="text-sm font-medium text-ink-900">{account.accountName}</div>
            <div className="num mt-0.5 text-xs text-ink-500">
              {bankName(account.bankCode)} · {account.accountNumber}
            </div>
            <div className="mt-2">
              <Pill tone={account.verified ? 'verified' : 'gold'}>{account.verified ? 'Name confirmed by the bank' : 'Name as you typed it, not confirmed'}</Pill>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Change account
          </Button>
        </div>
      )}

      {editing && providers && (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Bank</span>
            <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={inputClass}>
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Account number</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="10 digits"
              className={`${inputClass} num`}
            />
            {accountNumber && !numberOk && <span className="mt-1 block text-xs text-ink-500">Account numbers are 10 digits.</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Account name</span>
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputClass} />
            <span className="mt-1 block text-xs text-ink-500">
              {lookup ? 'The bank confirms the registered name when you save, and that name replaces what you typed.' : 'Type it exactly as it appears on the account. This provider cannot confirm it for you.'}
            </span>
          </label>
          {saveError && (
            <p role="alert" className="text-sm text-thread-600">
              {saveError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !numberOk || accountName.trim().length < 2}>
              {saving ? 'Saving…' : 'Link account'}
            </Button>
            {account?.accountNumber && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

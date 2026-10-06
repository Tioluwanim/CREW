'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Pill } from '../../components/ui/primitives';
import { formatNaira } from '../../lib/money';
import { getVirtualAccounts, openVirtualAccount, type VirtualAccount } from '../../services/payments';

/**
 * "Collect by bank transfer": a bank account number dedicated to one project, so a client can pay by transfer and
 * CREW can match the money to the project. Talks to /projects/{id}/virtual-account.
 */
export function VirtualAccountCard({ projectId }: { projectId: string }) {
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    getVirtualAccounts(projectId)
      .then((rows) => {
        if (active) setAccount(rows.find((r) => r.status === 'open') ?? null);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : 'Could not load bank transfer details'))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [projectId]);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      setAccount(await openVirtualAccount(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open a transfer account for this project');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink-900">Collect by bank transfer</h2>
          <p className="mt-1 text-xs text-ink-500">A bank account just for this project. Whatever your client sends to it is matched to this project.</p>
        </div>
        {account && <Pill tone="verified">Open</Pill>}
      </div>

      {account ? (
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-500">Bank</dt>
            <dd className="font-medium text-ink-900">{account.bankName}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Account number</dt>
            <dd className="num font-medium text-ink-900">{account.accountNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Account name</dt>
            <dd className="font-medium text-ink-900">{account.accountName}</dd>
          </div>
          {account.expectedAmount !== null && (
            <div>
              <dt className="text-xs text-ink-500">Expected amount</dt>
              <dd className="num font-medium text-ink-900">{formatNaira(account.expectedAmount)}</dd>
            </div>
          )}
        </dl>
      ) : (
        loaded && (
          <Button className="mt-4" variant="secondary" onClick={open} disabled={busy}>
            {busy ? 'Opening…' : 'Get transfer details'}
          </Button>
        )
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-thread-600">
          {error}
        </p>
      )}
    </Card>
  );
}

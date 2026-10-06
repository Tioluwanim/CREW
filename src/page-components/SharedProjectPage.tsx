'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Button, Pill, StatLabel } from '../components/ui/primitives';
import { EmptyState } from '../components/ui/states';
import { formatNaira } from '../lib/money';
import * as share from '../services/share';
import type { PayMethod, SharedPayment, SharedView } from '../services/share';

/**
 * The real no-signup client page, backed by the share-link API. A creator sends
 * `/c/{token}` (or the invoice's `/pay/{token}` link); the client can agree to the scope,
 * accept or decline priced changes, review deliveries, and pay. Payments go through whichever
 * provider the backend is configured with; the sandbox says plainly that no money moves.
 */
export function SharedProjectPage({ token }: { token: string }) {
  const [view, setView] = useState<SharedView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<SharedPayment | null>(null);
  const [paidNote, setPaidNote] = useState<string | null>(null);
  const [revisionFor, setRevisionFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      setView(await share.getSharedProject(token));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'This link is no longer valid');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      await load();
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24">
        <EmptyState message={loadError} />
      </main>
    );
  }
  if (!view) return <main className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-ink-500">Loading…</main>;

  const { project } = view;
  const payable = view.invoices.find((i) => i.status === 'sent');
  const stageLabel = project.stage.replace('_', ' ');
  const canAgree = project.stage === 'brief';
  const inReview = project.stage === 'in_review';

  async function pay(method: PayMethod) {
    await act(async () => {
      const res = await share.startPayment(token, { invoiceId: payable?.id, method });
      setPayment(res);
      setPaidNote(null);
    });
  }

  async function confirmPayment() {
    if (!payment) return;
    await act(async () => {
      const res = await share.verifyPayment(token, payment.reference);
      setPaidNote(res.status === 'verified' ? 'Payment verified. Thank you!' : `Payment is ${res.status}. It will update here once the bank confirms.`);
      if (res.status === 'verified') setPayment(null);
    });
  }

  return (
    <main className="atelier-paper min-h-screen px-6 py-12 text-ink-900 sm:px-8">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Sent to you by {project.creator ?? 'your creative'} on CREW</p>
          <h1 className="mt-1 font-display text-3xl">{project.name}</h1>
          <div className="mt-2 flex justify-center">
            <Pill tone={project.stage === 'closed' || project.stage === 'released' ? 'verified' : 'default'}>{stageLabel}</Pill>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-thread-600/30 bg-thread-600/5 p-3 text-sm text-thread-600">
            {error}
          </div>
        )}

        {view.deliverables.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-medium text-ink-700">What you are getting</h2>
            <ul className="space-y-2">
              {view.deliverables.map((d) => (
                <li key={d.id} className="rounded-lg border border-ink-900/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-900">{d.title}</span>
                    <Pill tone={d.status === 'approved' ? 'verified' : d.status === 'delivered' ? 'gold' : 'default'}>{d.status.replace('_', ' ')}</Pill>
                  </div>
                  {d.evidenceUrl && (
                    <a href={d.evidenceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
                      View delivery ↗
                    </a>
                  )}
                  {inReview && d.status === 'delivered' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button disabled={busy} onClick={() => act(() => share.approveDelivery(token, d.id))}>Approve</Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setRevisionFor(revisionFor === d.id ? null : d.id)}>Request a revision</Button>
                    </div>
                  )}
                  {revisionFor === d.id && (
                    <div className="mt-3 flex gap-2">
                      <input aria-label="Revision note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" className="flex-1 rounded-md border border-ink-900/15 bg-white px-2 py-1.5 text-sm" />
                      <Button
                        disabled={busy || !note.trim()}
                        onClick={() => act(async () => { await share.requestRevision(token, d.id, note.trim()); setNote(''); setRevisionFor(null); })}
                      >
                        Send
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">
              {project.revisionsUsed} of {project.revisionsIncluded} included revisions used.
            </p>
          </Card>
        )}

        {canAgree && (
          <Card className="p-5">
            <p className="mb-3 text-sm text-ink-700">Review the scope and price below, then agree to get started.</p>
            <Button className="w-full justify-center" disabled={busy} onClick={() => act(() => share.agreeToScope(token))}>
              I agree to this scope and price
            </Button>
          </Card>
        )}

        {view.changeRequests.map((c) => (
          <Card key={c.id} className="border-gold-500/30 bg-gold-100/40 p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gold-500">Change request</p>
            <p className="mb-1 text-sm text-ink-900">{c.title}</p>
            {c.description && <p className="mb-2 text-xs text-ink-500">{c.description}</p>}
            <p className="mb-3 text-sm text-ink-700">{c.amount > 0 ? `Adds ${formatNaira(c.amount)} to the total` : 'No extra charge'}</p>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => act(() => share.decideChange(token, c.id, 'accept'))}>Accept</Button>
              <Button variant="secondary" disabled={busy} onClick={() => act(() => share.decideChange(token, c.id, 'decline'))}>Decline</Button>
            </div>
          </Card>
        ))}

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <StatLabel>Total</StatLabel>
            <div className="num text-xl font-medium">{formatNaira(project.price)}</div>
          </div>
          <div className="mb-4 space-y-1.5 text-sm">
            <Line label="Deposit" value={`${project.depositPct}%`} />
            <Line label="Paid so far" value={formatNaira(view.paid)} />
            <Line label="Outstanding" value={formatNaira(view.outstanding)} />
          </div>

          {paidNote && <p className="mb-3 rounded-lg border border-verified-600/20 bg-verified-100/50 p-3 text-center text-sm text-verified-600">{paidNote}</p>}

          {payment ? (
            <div className="space-y-3 text-sm">
              <p className="text-ink-700">{payment.note}</p>
              {payment.virtualAccount && (
                <div className="rounded-lg border border-ink-900/10 bg-bone-100/60 p-3">
                  <Line label="Bank" value={payment.virtualAccount.bankName} />
                  <Line label="Account number" value={payment.virtualAccount.accountNumber} />
                  <Line label="Account name" value={payment.virtualAccount.accountName} />
                  <Line label="Amount" value={formatNaira(payment.amount)} />
                </div>
              )}
              {payment.instructions && <p className="text-ink-500">{payment.instructions}</p>}
              {payment.checkoutUrl && (
                <a href={payment.checkoutUrl} target="_blank" rel="noreferrer" className="block text-center font-medium underline underline-offset-4">
                  Open secure checkout ↗
                </a>
              )}
              <Button className="w-full justify-center" disabled={busy} onClick={confirmPayment}>
                I have paid, check my payment
              </Button>
            </div>
          ) : payable && view.outstanding > 0 ? (
            <div className="space-y-2">
              <Button className="w-full justify-center" disabled={busy} onClick={() => pay('checkout')}>
                Pay {formatNaira(payable.amount)} by card or bank
              </Button>
              <Button variant="secondary" className="w-full justify-center" disabled={busy} onClick={() => pay('virtual_account')}>
                Pay by bank transfer
              </Button>
            </div>
          ) : view.outstanding === 0 ? (
            <div className="rounded-lg border border-verified-600/20 bg-verified-100/50 p-3 text-center text-sm text-verified-600">Everything is paid.</div>
          ) : (
            <p className="text-center text-sm text-ink-500">No payment is due right now.</p>
          )}
        </Card>

        {view.timeline.length > 0 && (
          <Card className="divide-y divide-ink-900/10 p-1">
            {view.timeline.slice(-8).reverse().map((e, i) => (
              <div key={i} className="flex items-center justify-between p-3 text-xs">
                <span className="text-ink-700">{e.label}</span>
                <span className="text-ink-500">{new Date(e.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </main>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="num text-ink-900">{value}</span>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Card, Button, Pill, StatLabel } from '../components/ui/primitives';
import { ErrorState, LoadingSkeleton } from '../components/ui/states';
import { StageTracker, CLIENT_STEPS, clientStepIndex } from '../components/ui/StageTracker';
import { formatNaira } from '../lib/money';
import * as share from '../services/share';
import type { PayMethod, SharedPayment, SharedView, TransferDetails } from '../services/share';

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
  const [transfer, setTransfer] = useState<TransferDetails | null>(null);
  const [paidNote, setPaidNote] = useState<string | null>(null);
  const [revisionFor, setRevisionFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

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

  async function act(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (success) setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      await load();
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="atelier-paper min-h-screen px-6 py-24">
        <div className="mx-auto max-w-lg">
          <ErrorState
            message={loadError}
            detail="Ask the person who sent it to share the link again. If the link is right, check your connection and try again."
            onRetry={() => void load()}
          />
        </div>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="atelier-paper min-h-screen px-6 py-16" aria-busy="true">
        <div className="mx-auto max-w-xl" role="status" aria-label="Loading your project">
          <LoadingSkeleton rows={3} />
        </div>
      </main>
    );
  }

  const { project } = view;
  const payable = view.invoices.find((i) => i.status === 'sent');
  const canAgree = project.stage === 'brief' && view.deliverables.length > 0;
  const inReview = project.stage === 'in_review';
  const pendingChanges = view.changeRequests.length;
  const toReview = inReview ? view.deliverables.filter((d) => d.status === 'delivered').length : 0;
  const depositAmount = Math.round((project.price * project.depositPct) / 100);
  const step = clientStepIndex(project.stage);
  const nextStep = describeNextStep({ stage: project.stage, canAgree, pendingChanges, toReview, payableAmount: payable?.amount, outstanding: view.outstanding, hasDeliverables: view.deliverables.length > 0 });
  const goToPayment = () => document.getElementById('payment')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goToChanges = () => document.getElementById('changes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goToDeliveries = () => document.getElementById('deliveries')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function showTransferDetails() {
    await act(async () => {
      setTransfer(await share.getTransferDetails(token));
      setPaidNote(null);
    });
  }

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
        <header className="text-center">
          <p className="text-sm text-ink-500">From {project.creator ?? 'your creative'}</p>
          <h1 className="mt-1 font-display text-3xl">{project.name}</h1>
        </header>

        <Card className="p-5">
          <StageTracker steps={CLIENT_STEPS} current={step} label="Where your project is" />
        </Card>

        <Card className="border-ink-900/20 bg-white p-5" aria-live="polite">
          <h2 className="text-base font-medium text-ink-900">{nextStep.title}</h2>
          <p className="mt-1 text-sm text-ink-700">{nextStep.body}</p>
          {nextStep.action === 'agree' && (
            <>
              <p className="mt-3 text-sm text-ink-500">
                Total {formatNaira(project.price)}. After you agree, a deposit of {formatNaira(depositAmount)} ({project.depositPct}%) is due before work starts.
              </p>
              <Button className="mt-4 w-full justify-center" disabled={busy} onClick={() => act(() => share.agreeToScope(token), 'Thanks. You agreed to this scope and price.')}>
                {busy ? 'Saving…' : 'Agree to scope and price'}
              </Button>
            </>
          )}
          {nextStep.action === 'pay' && (
            <Button className="mt-4 w-full justify-center sm:w-auto" onClick={goToPayment}>
              Go to payment
            </Button>
          )}
          {nextStep.action === 'changes' && (
            <Button className="mt-4 w-full justify-center sm:w-auto" onClick={goToChanges}>
              Review the change
            </Button>
          )}
          {nextStep.action === 'review' && (
            <Button className="mt-4 w-full justify-center sm:w-auto" onClick={goToDeliveries}>
              Review the delivery
            </Button>
          )}
        </Card>

        {notice && (
          <div role="status" className="rounded-lg border border-verified-600/20 bg-verified-100/50 p-3 text-sm text-verified-600">
            {notice}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-thread-600/30 bg-thread-600/5 p-3 text-sm text-thread-600">
            {error}
          </div>
        )}

        {view.deliverables.length > 0 && (
          <Card className="p-5" id="deliveries">
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
                      <Button disabled={busy} onClick={() => act(() => share.approveDelivery(token, d.id), 'Approved. Thank you.')}>Approve</Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setRevisionFor(revisionFor === d.id ? null : d.id)}>Request a revision</Button>
                    </div>
                  )}
                  {revisionFor === d.id && (
                    <div className="mt-3 flex gap-2">
                      <textarea aria-label="Revision note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" className="flex-1 resize-y rounded-md border border-ink-900/15 bg-white px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900" />
                      <Button
                        disabled={busy || !note.trim()}
                        onClick={() => act(async () => { await share.requestRevision(token, d.id, note.trim()); setNote(''); setRevisionFor(null); }, 'Sent. Your creative will get back to you with a new version.')}
                      >
                        Send
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">
              {project.revisionsIncluded - project.revisionsUsed > 0 ? `${project.revisionsIncluded - project.revisionsUsed} of ${project.revisionsIncluded} revisions left. Extra rounds may cost more.` : 'No included revisions left. Extra rounds may cost more.'}
            </p>
          </Card>
        )}

        {view.changeRequests.map((c, i) => (
          <Card key={c.id} id={i === 0 ? 'changes' : undefined} className="border-gold-500/30 bg-gold-100/40 p-5">
            <p className="mb-1 text-xs font-medium text-gold-500">Your creative suggests a change</p>
            <p className="mb-1 text-sm text-ink-900">{c.title}</p>
            {c.description && <p className="mb-2 text-xs text-ink-500">{c.description}</p>}
            <p className="mb-3 text-sm text-ink-700">{c.amount > 0 ? `Adds ${formatNaira(c.amount)} to the total` : 'No extra charge'}</p>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => act(() => share.decideChange(token, c.id, 'accept'), 'Change accepted. The total has been updated.')}>Accept</Button>
              <Button variant="secondary" disabled={busy} onClick={() => act(() => share.decideChange(token, c.id, 'decline'), 'Change declined. Nothing was added to your total.')}>Decline</Button>
            </div>
          </Card>
        ))}

        <Card className="p-5" id="payment">
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

          {transfer && !payment && (
            <div className="mb-3 space-y-2 rounded-lg border border-ink-900/10 bg-bone-100/60 p-3 text-sm">
              <Line label="Bank" value={transfer.bankName} />
              <Line label="Account number" value={transfer.accountNumber} copy />
              <Line label="Account name" value={transfer.accountName} />
              <p className="text-xs text-ink-500">Send any amount up to {formatNaira(transfer.outstanding)}. Transfers to this account are matched to this project automatically; press refresh after you have paid.</p>
              <Button variant="secondary" className="w-full justify-center" disabled={busy} onClick={() => act(async () => undefined)}>
                Refresh my balance
              </Button>
            </div>
          )}

          {payment ? (
            <div className="space-y-3 text-sm">
              <p className="text-ink-700">{payment.note}</p>
              {payment.virtualAccount && (
                <div className="rounded-lg border border-ink-900/10 bg-bone-100/60 p-3">
                  <Line label="Bank" value={payment.virtualAccount.bankName} />
                  <Line label="Account number" value={payment.virtualAccount.accountNumber} copy />
                  <Line label="Account name" value={payment.virtualAccount.accountName} />
                  <Line label="Amount" value={formatNaira(payment.amount)} />
                </div>
              )}
              {payment.instructions && payment.instructions !== payment.note && <p className="text-ink-500">{payment.instructions}</p>}
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
              <Button variant="secondary" className="w-full justify-center" disabled={busy} onClick={showTransferDetails}>
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
          <section aria-label="Recent activity">
          <h2 className="mb-2 px-1 text-sm font-medium text-ink-700">Recent activity</h2>
          <Card className="divide-y divide-ink-900/10 p-1">
            {view.timeline.slice(-8).reverse().map((e, i) => (
              <div key={i} className="flex items-center justify-between p-3 text-xs">
                <span className="text-ink-700">{e.label}</span>
                <span className="text-ink-500">{new Date(e.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </Card>
          </section>
        )}
      </div>
    </main>
  );
}

function Line({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the number is still on screen */
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="num text-ink-900">{value}</span>
        {copy && (
          <button type="button" onClick={doCopy} aria-label={`Copy ${label.toLowerCase()}`} className="rounded p-1 text-ink-500 hover:bg-ink-900/5 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </span>
    </div>
  );
}

type NextStep = { title: string; body: string; action?: 'agree' | 'pay' | 'changes' | 'review' };

function describeNextStep(i: { stage: string; canAgree: boolean; pendingChanges: number; toReview: number; payableAmount?: number; outstanding: number; hasDeliverables: boolean }): NextStep {
  if (i.pendingChanges > 0) return { title: 'Your creative suggested a change', body: 'Accept it to update the total, or decline to keep things as they are.', action: 'changes' };
  switch (i.stage) {
    case 'brief':
      return i.canAgree
        ? { title: 'Read the scope, then agree', body: 'Check what you are getting and the price below. Nothing is charged until you agree and pay the deposit.', action: 'agree' }
        : { title: 'Your creative is preparing the scope', body: 'You will be able to agree here as soon as it is ready. Check back soon.' };
    case 'agreed':
      return i.payableAmount ? { title: 'Pay the deposit to start', body: 'Work begins once the deposit is confirmed.', action: 'pay' } : { title: 'Waiting for the deposit invoice', body: 'Your creative will send it shortly.' };
    case 'funded':
    case 'in_progress':
      return { title: 'Work is underway', body: 'Nothing is needed from you right now. You will see updates here.' };
    case 'in_review':
      return i.toReview > 0 ? { title: 'Review what was delivered', body: 'Approve each item, or ask for a revision and say what should change.', action: 'review' } : { title: 'Waiting on your creative', body: 'Nothing is ready to review yet.' };
    case 'approved':
      return i.outstanding > 0 && i.payableAmount ? { title: 'Pay the balance', body: 'Everything is approved. Paying the balance finishes the project.', action: 'pay' } : { title: 'Approved', body: 'Your creative is wrapping up. Nothing is needed from you.' };
    default:
      return { title: 'All done', body: 'This project is finished. Thank you.' };
  }
}

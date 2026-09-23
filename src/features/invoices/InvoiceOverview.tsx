'use client';

import { useCopilotRoute } from '../../components/copilot/CopilotContext';
import { EcobankBadge } from '../../components/ui/EcobankBadge';
import { Button, Card, Pill } from '../../components/ui/primitives';
import { formatNaira } from '../../lib/money';
import { useInvoiceModel } from './useInvoiceModel';

export function InvoiceOverview() {
  useCopilotRoute('invoices');
  const { project, invoiceApproved, approveInvoice, derived } = useInvoiceModel();
  return <div><header className="mb-6"><h1 className="font-display text-3xl text-ink-900">Invoices</h1><p className="mt-1 text-sm text-ink-500">Nothing goes to a client without your approval.</p></header><Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-medium text-ink-900">{project.name}</div><div className="text-xs text-ink-500">{project.clientName}</div></div><Pill tone={invoiceApproved ? 'verified' : 'gold'}>{invoiceApproved ? 'Approved' : 'Waiting for approval'}</Pill></div><div className="mb-4"><EcobankBadge /></div><div className="mb-5 space-y-2 rounded-lg border border-ink-900/10 bg-bone-100/60 p-4 text-sm"><Row label="Amount" value={formatNaira(project.revenue)} /><Row label={`Deposit (${project.depositPct}%)`} value={formatNaira(derived.depositAmount)} /><Row label="Balance" value={formatNaira(project.revenue - derived.depositAmount)} /></div>{!invoiceApproved ? <p className="mb-4 text-xs text-ink-500">CREW prepared this invoice. Nothing has been sent yet.</p> : <p className="mb-4 text-xs text-verified-600">Approved and ready — WhatsApp message prepared for {project.clientName}.</p>}<div className="flex gap-2"><Button variant="secondary">Edit</Button>{!invoiceApproved && <Button onClick={approveInvoice}>Approve &amp; send</Button>}</div></Card><p className="mt-4 text-xs text-ink-500">CREW's payment verification is designed to run on Ecobank's sandbox APIs as the primary rail. No live bank connection exists in this build — payments above are simulated for the demo.</p></div>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between"><span className="text-ink-500">{label}</span><span className="num font-medium">{value}</span></div>; }
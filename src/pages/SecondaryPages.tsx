import { useProjectStore } from '../store/projectStore';
import { useCopilotRoute } from '../components/copilot/CopilotContext';
import { Card, Button, Pill } from '../components/ui/primitives';
import { EcobankBadge } from '../components/ui/EcobankBadge';
import { formatNaira } from '../lib/money';
import { teniClient, amaraProfile } from '../data/demoData';

export function InvoicesPage() {
  useCopilotRoute('invoices');
  const project = useProjectStore((s) => s.project);
  const invoiceApproved = useProjectStore((s) => s.invoiceApproved);
  const approveInvoice = useProjectStore((s) => s.approveInvoice);
  const derived = useProjectStore((s) => s.derived)();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Invoices</h1>
        <p className="mt-1 text-sm text-ink-500">Nothing goes to a client without your approval.</p>
      </header>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink-900">{project.name}</div>
            <div className="text-xs text-ink-500">{project.clientName}</div>
          </div>
          <Pill tone={invoiceApproved ? 'verified' : 'gold'}>{invoiceApproved ? 'Approved' : 'Waiting for approval'}</Pill>
        </div>
        <div className="mb-4">
          <EcobankBadge />
        </div>
        <div className="mb-5 space-y-2 rounded-lg border border-ink-900/10 bg-bone-100/60 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Amount</span>
            <span className="num font-medium">{formatNaira(project.revenue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Deposit ({project.depositPct}%)</span>
            <span className="num font-medium">{formatNaira(derived.depositAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Balance</span>
            <span className="num font-medium">{formatNaira(project.revenue - derived.depositAmount)}</span>
          </div>
        </div>
        {!invoiceApproved ? (
          <p className="mb-4 text-xs text-ink-500">CREW prepared this invoice. Nothing has been sent yet.</p>
        ) : (
          <p className="mb-4 text-xs text-verified-600">Approved and ready — WhatsApp message prepared for {project.clientName}.</p>
        )}
        <div className="flex gap-2">
          <Button variant="secondary">Edit</Button>
          {!invoiceApproved && <Button onClick={approveInvoice}>Approve &amp; send</Button>}
        </div>
      </Card>

      <p className="mt-4 text-xs text-ink-500">
        CREW's payment verification is designed to run on Ecobank's sandbox APIs as the primary rail. No live bank
        connection exists in this build — payments above are simulated for the demo.
      </p>
    </div>
  );
}

export function ClientsPage() {
  useCopilotRoute('clients');
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Clients</h1>
        <p className="mt-1 text-sm text-ink-500">How your clients actually pay, in plain terms.</p>
      </header>
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-medium text-ink-900">{teniClient.name}</h3>
          <span className="text-xs text-ink-500">{teniClient.averagePaymentDays} day avg. payment</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Field label="Projects" value={String(teniClient.projectIds.length)} />
          <Field label="Total billed" value={formatNaira(teniClient.totalBilled)} />
          <Field label="Total paid" value={formatNaira(teniClient.totalPaid)} />
        </div>
      </Card>
    </div>
  );
}

export function ProfitPage() {
  const derived = useProjectStore((s) => s.derived)();
  const project = useProjectStore((s) => s.project);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Profit</h1>
        <p className="mt-1 text-sm text-ink-500">{amaraProfile.businessName} — this month.</p>
      </header>
      <Card className="p-5">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Field label="Revenue" value={formatNaira(project.revenue)} />
          <Field label="Costs" value={formatNaira(project.costs.reduce((s, c) => s + c.amount, 0))} />
          <Field label="Profit" value={formatNaira(derived.expectedProfit)} />
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="num font-medium text-ink-900">{value}</div>
    </div>
  );
}

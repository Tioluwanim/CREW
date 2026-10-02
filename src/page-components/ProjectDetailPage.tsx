'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProjectStore } from '../store/projectStore';
import { useCopilotRoute } from '../components/copilot/CopilotContext';
import { Card, StatLabel, StatValue, Pill, Button } from '../components/ui/primitives';
import { EcobankBadge } from '../components/ui/EcobankBadge';
import { EmptyState } from '../components/ui/states';
import { DepositSlider } from '../components/forms/DepositSlider';
import { CashFlowChart } from '../components/charts/CashFlowChart';
import { formatNaira } from '../lib/money';
import { otherProjects } from '../data/demoData';
import {
  recommendMinimumSafeDeposit,
  calculateDepositImpact,
  calculateExpectedProfit,
  calculateProfitMargin,
  buildCashFlowProjection,
} from '../lib/finance';
import type { ChangeRequest, Milestone, MilestoneStatus, Project, PaymentStatus } from '../types';

const TABS = ['Overview', 'Scope', 'Changes', 'Payments', 'Costs & Profit', 'Timeline'] as const;
type Tab = (typeof TABS)[number];

const MILESTONE_STEPS: MilestoneStatus[] = ['agreed', 'funded', 'in_progress', 'in_review', 'approved', 'released'];
const MILESTONE_STEP_LABEL: Record<MilestoneStatus, string> = {
  agreed: 'Agreed',
  funded: 'Funded',
  in_progress: 'In progress',
  in_review: 'In review',
  approved: 'Approved',
  released: 'Released',
};

export function ProjectDetailPage() {
  useCopilotRoute('project');
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('Overview');

  const heroProject = useProjectStore((s) => s.project);
  const setDepositPct = useProjectStore((s) => s.setDepositPct);
  const updateCost = useProjectStore((s) => s.updateCost);
  const heroPaymentStatus = useProjectStore((s) => s.paymentStatus);
  const simulatePayment = useProjectStore((s) => s.simulatePayment);
  const invoiceApproved = useProjectStore((s) => s.invoiceApproved);
  const approveInvoice = useProjectStore((s) => s.approveInvoice);
  const classifyChangeRequest = useProjectStore((s) => s.classifyChangeRequest);
  const approveChangeRequest = useProjectStore((s) => s.approveChangeRequest);
  const advanceMilestone = useProjectStore((s) => s.advanceMilestone);
  const heroDerived = useProjectStore((s) => s.derived)();

  const isHero = !id || id === heroProject.id;
  const staticProject = isHero ? null : otherProjects.find((p) => p.id === id);

  if (!isHero && !staticProject) {
    return (
      <div>
        <EmptyState message="This project doesn't exist in the demo dataset." />
        <div className="mt-4 text-center">
          <Link href="/app/projects" className="text-sm font-medium text-ink-700 underline underline-offset-4">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const project: Project = isHero ? heroProject : staticProject!;
  const paymentStatus: PaymentStatus = isHero ? heroPaymentStatus : staticProject!.status === 'completed' ? 'verified' : 'pending';
  const recommended = recommendMinimumSafeDeposit(project.costs, project.revenue);

  const derived = isHero
    ? heroDerived
    : (() => {
        const impact = calculateDepositImpact(project.costs, project.revenue, project.depositPct, project.expectedPaymentDays);
        return {
          depositAmount: impact.depositAmount,
          upfrontExposure: impact.upfrontExposure,
          cashGap: impact.cashGap,
          expectedProfit: calculateExpectedProfit(project.costs, project.revenue),
          profitMargin: calculateProfitMargin(project.costs, project.revenue),
          cashFlow: buildCashFlowProjection(project.costs, project.revenue, project.depositPct, project.expectedPaymentDays, 0),
        };
      })();

  const pendingChangeRequests = (project.changeRequests ?? []).filter((cr) => cr.status === 'pending');
  const nextAction = describeNextAction({ isHero, pendingChangeRequests, invoiceApproved, paymentStatus, cashGap: derived.cashGap });

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl text-ink-900">{project.name}</h1>
          <Pill tone={paymentStatus === 'verified' ? 'verified' : 'default'}>
            {paymentStatus === 'verified' ? 'Completed' : 'In progress'}
          </Pill>
          {!isHero && <Pill>Read-only in this demo</Pill>}
        </div>
        <p className="mt-1 text-sm text-ink-500">
          {project.clientName} · {project.craft}
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <StatLabel>Revenue</StatLabel>
          <StatValue>{formatNaira(project.revenue)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Expected profit</StatLabel>
          <StatValue tone="verified">{formatNaira(derived.expectedProfit)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Upfront exposure</StatLabel>
          <StatValue tone={derived.upfrontExposure > 0 ? 'thread' : 'default'}>{formatNaira(derived.upfrontExposure)}</StatValue>
        </Card>
        <Card className="p-4">
          <StatLabel>Days to cash</StatLabel>
          <StatValue>{project.expectedPaymentDays}</StatValue>
        </Card>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-900/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === t ? 'border-ink-900 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            {t}
            {t === 'Changes' && pendingChangeRequests.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-semibold text-bone-50">
                {pendingChangeRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gold-500">Next action</div>
            <p className="text-sm text-ink-900">{nextAction}</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-700">Deposit</h2>
            {isHero ? (
              <DepositSlider value={project.depositPct} onChange={setDepositPct} recommended={recommended} />
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-ink-900/10 bg-bone-100/50 p-3">
                <span className="text-sm text-ink-500">Deposit</span>
                <span className="num text-lg font-medium text-ink-900">{project.depositPct}%</span>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-900/10 pt-5 sm:grid-cols-3">
              <div>
                <StatLabel>Deposit amount</StatLabel>
                <div className="num text-lg font-medium text-ink-900">{formatNaira(derived.depositAmount)}</div>
              </div>
              <div>
                <StatLabel>Projected cash gap</StatLabel>
                <div className={`num text-lg font-medium ${derived.cashGap > 0 ? 'text-thread-600' : 'text-verified-600'}`}>
                  {derived.cashGap > 0 ? formatNaira(derived.cashGap) : 'No gap'}
                </div>
              </div>
              <div>
                <StatLabel>Margin</StatLabel>
                <div className="num text-lg font-medium text-ink-900">{derived.profitMargin.toFixed(1)}%</div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-medium text-ink-700">Projected cash position</h2>
            <p className="mb-4 text-xs text-ink-500">Assumes today's cash on hand is ₦0 for this project view.</p>
            <CashFlowChart points={derived.cashFlow} />
          </Card>
        </div>
      )}

      {tab === 'Scope' && (
        <ScopeTab project={project} pendingChangeRequests={pendingChangeRequests} onGoToChanges={() => setTab('Changes')} />
      )}

      {tab === 'Changes' && (
        <ChangesTab
          project={project}
          isHero={isHero}
          onClassify={classifyChangeRequest}
          onApprove={approveChangeRequest}
        />
      )}

      {tab === 'Payments' && (
        <PaymentsTab
          project={project}
          isHero={isHero}
          paymentStatus={paymentStatus}
          invoiceApproved={invoiceApproved}
          derived={derived}
          onApproveInvoice={approveInvoice}
          onSimulatePayment={simulatePayment}
          onAdvanceMilestone={advanceMilestone}
        />
      )}

      {tab === 'Costs & Profit' && (
        <div className="space-y-6">
          <Card className="divide-y divide-ink-900/10 p-1">
            {project.costs.map((cost) =>
              isHero ? (
                <div key={cost.id} className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm font-medium text-ink-700">{cost.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="num text-sm text-ink-500">₦</span>
                    <input
                      type="number"
                      value={cost.amount}
                      onChange={(e) => updateCost(cost.id, Number(e.target.value))}
                      className="num w-28 rounded-md border border-ink-900/15 bg-white px-2 py-1 text-right text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900"
                      aria-label={`${cost.label} amount`}
                    />
                  </div>
                </div>
              ) : (
                <div key={cost.id} className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm font-medium text-ink-700">{cost.label}</span>
                  <span className="num text-sm text-ink-900">{formatNaira(cost.amount)}</span>
                </div>
              ),
            )}
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-medium text-ink-900">Total costs</span>
              <span className="num text-sm font-medium text-ink-900">
                {formatNaira(project.costs.reduce((sum, c) => sum + c.amount, 0))}
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <StatLabel>Revenue</StatLabel>
                <div className="num text-lg font-medium">{formatNaira(project.revenue)}</div>
              </div>
              <div>
                <StatLabel>Costs</StatLabel>
                <div className="num text-lg font-medium">{formatNaira(project.costs.reduce((s, c) => s + c.amount, 0))}</div>
              </div>
              <div>
                <StatLabel>Profit</StatLabel>
                <div className="num text-lg font-medium text-verified-600">{formatNaira(derived.expectedProfit)}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'Timeline' && (
        <Card className="divide-y divide-ink-900/10 p-1">
          {project.activity.map((event) => (
            <div key={event.id} className="flex items-center justify-between p-4 text-sm">
              <span className="text-ink-700">{event.label}</span>
              <span className="text-xs text-ink-500">{new Date(event.timestamp).toLocaleDateString()}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function describeNextAction({
  isHero,
  pendingChangeRequests,
  invoiceApproved,
  paymentStatus,
  cashGap,
}: {
  isHero: boolean;
  pendingChangeRequests: ChangeRequest[];
  invoiceApproved: boolean;
  paymentStatus: PaymentStatus;
  cashGap: number;
}) {
  if (!isHero) return 'This is a completed demo project — nothing to act on.';
  if (pendingChangeRequests.length > 0) {
    return `${pendingChangeRequests[0].label} — classify it as included or extra in the Changes tab.`;
  }
  if (!invoiceApproved) return 'Approve and send the invoice from the Payments tab to get this deal started.';
  if (paymentStatus !== 'verified') return "Waiting on the balance payment — you can simulate it from the Payments tab.";
  if (cashGap > 0) return 'This project has a projected cash gap — consider raising the deposit.';
  return 'Nothing needs your attention on this deal right now.';
}

function ScopeTab({
  project,
  pendingChangeRequests,
  onGoToChanges,
}: {
  project: Project;
  pendingChangeRequests: ChangeRequest[];
  onGoToChanges: () => void;
}) {
  if (!project.scope || project.scope.length === 0) {
    return <EmptyState message="Scope isn't tracked for this project yet." />;
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-medium text-ink-700">Agreed scope</h2>
      <ul className="divide-y divide-ink-900/10">
        {project.scope.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-3">
            <span className="text-sm text-ink-900">
              {item.quantity} {item.unit}
              {item.quantity > 1 ? 's' : ''} — {item.label}
              {item.quantity > 1 ? 's' : ''}
            </span>
            <Pill tone={item.status === 'appended' ? 'verified' : 'default'}>
              {item.status === 'appended' ? 'Appended' : 'Locked'}
            </Pill>
          </li>
        ))}
      </ul>
      {pendingChangeRequests.length > 0 && (
        <button
          type="button"
          onClick={onGoToChanges}
          className="mt-4 w-full rounded-lg border border-gold-500/30 bg-gold-100/50 p-3 text-left text-sm text-ink-700 transition-colors hover:border-gold-500/50"
        >
          <span className="font-medium">{pendingChangeRequests.length}</span> pending {pendingChangeRequests.length === 1 ? 'change' : 'changes'} not yet reflected here — go to Changes →
        </button>
      )}
    </Card>
  );
}

function ChangesTab({
  project,
  isHero,
  onClassify,
  onApprove,
}: {
  project: Project;
  isHero: boolean;
  onClassify: (id: string, classification: 'included' | 'extra') => void;
  onApprove: (id: string, side: 'creator' | 'client') => void;
}) {
  const changeRequests = project.changeRequests ?? [];

  if (changeRequests.length === 0) {
    return <EmptyState message="No change requests on this project." />;
  }

  return (
    <div className="space-y-4">
      {changeRequests.map((cr) => (
        <ChangeRequestCard key={cr.id} changeRequest={cr} isHero={isHero} onClassify={onClassify} onApprove={onApprove} />
      ))}
    </div>
  );
}

function ChangeRequestCard({
  changeRequest,
  isHero,
  onClassify,
  onApprove,
}: {
  changeRequest: ChangeRequest;
  isHero: boolean;
  onClassify: (id: string, classification: 'included' | 'extra') => void;
  onApprove: (id: string, side: 'creator' | 'client') => void;
}) {
  const isExtra = changeRequest.classification === 'extra';
  const isIncluded = changeRequest.classification === 'included';
  const resolved = changeRequest.status === 'accepted';

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-900">{changeRequest.label}</p>
          <p className="mt-0.5 text-xs text-ink-500">Asked {new Date(changeRequest.createdAt).toLocaleDateString()}</p>
        </div>
        <Pill tone={resolved ? 'verified' : changeRequest.classification ? 'gold' : 'default'}>
          {resolved ? (isIncluded ? 'Included' : 'Agreed — extra') : changeRequest.classification ? 'Awaiting approval' : 'Unclassified'}
        </Pill>
      </div>

      {!changeRequest.classification && isHero && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onClassify(changeRequest.id, 'included')}>
            Included — no charge
          </Button>
          <Button onClick={() => onClassify(changeRequest.id, 'extra')}>
            Extra — {formatNaira(changeRequest.priceImpact)}
          </Button>
        </div>
      )}

      {isIncluded && (
        <p className="text-sm text-verified-600">Marked as already covered by the original scope — no price change, no approval needed.</p>
      )}

      {isExtra && !resolved && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={changeRequest.creatorApproved ? 'primary' : 'secondary'}
            onClick={() => isHero && onApprove(changeRequest.id, 'creator')}
            disabled={!isHero}
          >
            {changeRequest.creatorApproved && <Check className="mr-1 inline size-3.5" aria-hidden="true" />}
            {changeRequest.creatorApproved ? 'You approved' : 'You approve'}
          </Button>
          <Button
            variant={changeRequest.clientApproved ? 'primary' : 'secondary'}
            onClick={() => isHero && onApprove(changeRequest.id, 'client')}
            disabled={!isHero}
          >
            {changeRequest.clientApproved && <Check className="mr-1 inline size-3.5" aria-hidden="true" />}
            {changeRequest.clientApproved ? 'Client approved' : 'Simulate client approval'}
          </Button>
        </div>
      )}

      {isExtra && resolved && (
        <p className="text-sm text-verified-600">
          Both sides approved — {formatNaira(changeRequest.priceImpact)} added to the total, and it's now part of the locked scope.
        </p>
      )}
    </Card>
  );
}

function PaymentsTab({
  project,
  isHero,
  paymentStatus,
  invoiceApproved,
  derived,
  onApproveInvoice,
  onSimulatePayment,
  onAdvanceMilestone,
}: {
  project: Project;
  isHero: boolean;
  paymentStatus: PaymentStatus;
  invoiceApproved: boolean;
  derived: { depositAmount: number };
  onApproveInvoice: () => void;
  onSimulatePayment: () => void;
  onAdvanceMilestone: (id: string) => void;
}) {
  if (!project.milestones || project.milestones.length === 0) {
    // Older demo projects don't model milestones — fall back to the
    // simple invoice/payment view rather than showing nothing.
    return (
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-ink-700">Balance payment</span>
          <Pill tone={paymentStatus === 'verified' ? 'verified' : 'default'}>{paymentStatus === 'verified' ? 'Verified' : 'Pending'}</Pill>
        </div>
        <div className="mb-4">
          <EcobankBadge />
        </div>
        <p className="text-sm text-ink-500">
          {paymentStatus === 'verified' ? 'Payment verified for this project.' : 'Payment still pending for this project.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!isHero || invoiceApproved ? null : (
        <Card className="p-5">
          <p className="mb-4 text-sm text-ink-700">CREW prepared this invoice. Nothing has been sent yet.</p>
          <div className="mb-5 space-y-2 rounded-lg border border-ink-900/10 bg-bone-100/60 p-4 text-sm">
            <Row label="Client" value={project.clientName} />
            <Row label="Amount" value={formatNaira(project.revenue)} />
            <Row label="Deposit" value={`${project.depositPct}% · ${formatNaira(derived.depositAmount)}`} />
            <Row label="Balance" value={formatNaira(project.revenue - derived.depositAmount)} />
          </div>
          <Button onClick={onApproveInvoice}>Approve &amp; send</Button>
        </Card>
      )}

      {isHero && invoiceApproved && (
        <Card className="flex items-center justify-between p-4">
          <span className="text-sm text-ink-700">No-signup client link, sent to {project.clientName}</span>
          <a
            href={`/pay/${project.id}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm font-medium text-ink-900 underline underline-offset-4 hover:text-ink-700"
          >
            View client link ↗
          </a>
        </Card>
      )}

      {project.milestones.map((milestone) => (
        <MilestoneCard
          key={milestone.id}
          milestone={milestone}
          isHero={isHero}
          invoiceApproved={invoiceApproved}
          onAdvance={() => {
            // "Funded" is the moment money actually arrives — fire the
            // payment-verified side effect on the agreed -> funded step,
            // not one step later.
            if (milestone.id === 'ms-balance' && milestone.status === 'agreed') onSimulatePayment();
            onAdvanceMilestone(milestone.id);
          }}
        />
      ))}
    </div>
  );
}

function MilestoneCard({
  milestone,
  isHero,
  invoiceApproved,
  onAdvance,
}: {
  milestone: Milestone;
  isHero: boolean;
  invoiceApproved: boolean;
  onAdvance: () => void;
}) {
  const currentIndex = MILESTONE_STEPS.indexOf(milestone.status);
  const isReleased = milestone.status === 'released';
  // The deposit milestone can't move before the invoice is actually sent.
  const blocked = milestone.id === 'ms-deposit' ? !invoiceApproved : false;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-900">{milestone.label}</p>
          <p className="num text-xs text-ink-500">{formatNaira(milestone.amount)}</p>
        </div>
        <Pill tone={isReleased ? 'verified' : 'default'}>{MILESTONE_STEP_LABEL[milestone.status]}</Pill>
      </div>

      <div className="mb-4 flex items-center gap-1">
        {MILESTONE_STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 items-center gap-1">
            <div className={`h-1.5 flex-1 rounded-full ${i <= currentIndex ? 'bg-verified-600' : 'bg-ink-900/10'}`} />
          </div>
        ))}
      </div>

      {milestone.status === 'funded' && (
        <p className="mb-3 text-xs text-ink-500">Payment received, held until you approve delivery.</p>
      )}

      {isHero && !isReleased && (
        <Button variant="secondary" onClick={onAdvance} disabled={blocked}>
          {blocked ? 'Send invoice first' : `Advance to ${MILESTONE_STEP_LABEL[MILESTONE_STEPS[currentIndex + 1]]}`}
        </Button>
      )}
      {!isHero && <p className="text-sm text-ink-500">Read-only in this demo.</p>}
      {isHero && isReleased && <p className="text-sm text-verified-600">Released to you.</p>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="num font-medium text-ink-900">{value}</span>
    </div>
  );
}

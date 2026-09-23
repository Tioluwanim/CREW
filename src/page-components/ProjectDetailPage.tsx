'use client';

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
import type { Project, PaymentStatus } from '../types';

const TABS = ['Overview', 'Budget', 'Forecast', 'Invoices', 'Payments', 'Profit', 'Activity'] as const;
type Tab = (typeof TABS)[number];

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
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
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
      )}

      {tab === 'Budget' && (
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
      )}

      {tab === 'Forecast' && (
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-medium text-ink-700">Projected cash position</h2>
          <p className="mb-4 text-xs text-ink-500">Assumes today's cash on hand is ₦0 for this project view.</p>
          <CashFlowChart points={derived.cashFlow} />
        </Card>
      )}

      {tab === 'Invoices' && (
        <Card className="p-5">
          {isHero ? (
            !invoiceApproved ? (
              <>
                <p className="mb-4 text-sm text-ink-700">CREW prepared this invoice. Nothing has been sent yet.</p>
                <div className="mb-5 space-y-2 rounded-lg border border-ink-900/10 bg-bone-100/60 p-4 text-sm">
                  <Row label="Client" value={project.clientName} />
                  <Row label="Amount" value={formatNaira(project.revenue)} />
                  <Row label="Deposit" value={`${project.depositPct}% · ${formatNaira(derived.depositAmount)}`} />
                  <Row label="Balance" value={formatNaira(project.revenue - derived.depositAmount)} />
                  <Row label="Due" value={`${project.expectedPaymentDays} days after delivery`} />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary">Edit</Button>
                  <Button onClick={approveInvoice}>Approve &amp; send</Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-verified-600">Invoice approved. WhatsApp-ready message copied to client.</div>
            )
          ) : (
            <div className="space-y-2 rounded-lg border border-ink-900/10 bg-bone-100/60 p-4 text-sm">
              <Row label="Client" value={project.clientName} />
              <Row label="Amount" value={formatNaira(project.revenue)} />
              <Row label="Deposit" value={`${project.depositPct}% · ${formatNaira(derived.depositAmount)}`} />
              <Row label="Balance" value={formatNaira(project.revenue - derived.depositAmount)} />
            </div>
          )}
        </Card>
      )}

      {tab === 'Payments' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Balance payment</span>
            <Pill tone={paymentStatus === 'verified' ? 'verified' : 'default'}>
              {paymentStatus === 'verified' ? 'Verified' : 'Pending'}
            </Pill>
          </div>
          <div className="mb-4">
            <EcobankBadge />
          </div>
          {isHero ? (
            paymentStatus !== 'verified' ? (
              <Button onClick={simulatePayment}>Simulate client payment</Button>
            ) : (
              <p className="text-sm text-ink-500">Payment verified. Project cash position and profit have been updated.</p>
            )
          ) : (
            <p className="text-sm text-ink-500">
              {paymentStatus === 'verified' ? 'Payment verified for this project.' : 'Payment still pending for this project.'}
            </p>
          )}
        </Card>
      )}

      {tab === 'Profit' && (
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
      )}

      {tab === 'Activity' && (
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="num font-medium text-ink-900">{value}</span>
    </div>
  );
}

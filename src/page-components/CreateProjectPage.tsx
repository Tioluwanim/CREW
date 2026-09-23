'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, StatLabel, Button } from '../components/ui/primitives';
import { DepositSlider } from '../components/forms/DepositSlider';
import { formatNaira } from '../lib/money';
import { calculateDepositImpact, calculateExpectedProfit, recommendMinimumSafeDeposit } from '../lib/finance';
import type { ProjectCost } from '../types';

const STEPS = ['Details', 'Client', 'Price', 'Deposit', 'Costs', 'Review'] as const;

interface Draft {
  name: string;
  clientName: string;
  price: string;
  depositPct: number;
  costs: { label: string; amount: string }[];
}

const initialDraft: Draft = {
  name: '',
  clientName: '',
  price: '',
  depositPct: 40,
  costs: [
    { label: 'Materials', amount: '' },
    { label: 'Labour', amount: '' },
  ],
};

export function CreateProjectPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [created, setCreated] = useState(false);
  const router = useRouter();

  const step = STEPS[stepIndex];
  const revenue = Number(draft.price) || 0;
  const costs: ProjectCost[] = draft.costs
    .filter((c) => c.label.trim() && Number(c.amount) > 0)
    .map((c, i) => ({ id: `draft-${i}`, label: c.label, category: 'other', amount: Number(c.amount), fundedBy: 'creator', paidOnDay: 0 }));

  const impact = revenue > 0 ? calculateDepositImpact(costs, revenue, draft.depositPct, 14) : null;
  const profit = revenue > 0 ? calculateExpectedProfit(costs, revenue) : 0;
  const recommended = revenue > 0 ? recommendMinimumSafeDeposit(costs, revenue) : null;

  const canContinue =
    (step === 'Details' && draft.name.trim() !== '') ||
    (step === 'Client' && draft.clientName.trim() !== '') ||
    (step === 'Price' && revenue > 0) ||
    step === 'Deposit' ||
    (step === 'Costs' && costs.length > 0) ||
    step === 'Review';

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else setCreated(true);
  }
  function back() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  function updateCostRow(i: number, field: 'label' | 'amount', value: string) {
    setDraft((d) => ({ ...d, costs: d.costs.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)) }));
  }
  function addCostRow() {
    setDraft((d) => ({ ...d, costs: [...d.costs, { label: '', amount: '' }] }));
  }

  if (created) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl text-ink-900">"{draft.name}" is set up.</h1>
          <p className="mt-2 text-sm text-ink-500">
            This demo keeps Amara's Aso-ebi order as the one editable project — your new project's numbers were calculated
            using the same math, but won't persist as a separate workspace entry here.
          </p>
          <Button className="mt-6" onClick={() => router.push('/app/projects')}>
            Back to projects
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">New project</h1>
        <div className="mt-4 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-ink-900' : 'bg-ink-900/10'}`} />
          ))}
        </div>
      </header>

      <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        {step === 'Details' && (
          <Card className="p-5">
            <label className="mb-2 block text-sm font-medium text-ink-700">Project name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Birthday photoshoot"
              autoFocus
              className="w-full rounded-lg border border-ink-900/15 px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900"
            />
          </Card>
        )}

        {step === 'Client' && (
          <Card className="p-5">
            <label className="mb-2 block text-sm font-medium text-ink-700">Client name</label>
            <input
              value={draft.clientName}
              onChange={(e) => setDraft({ ...draft, clientName: e.target.value })}
              placeholder="e.g. Zainab"
              autoFocus
              className="w-full rounded-lg border border-ink-900/15 px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900"
            />
          </Card>
        )}

        {step === 'Price' && (
          <Card className="p-5">
            <label className="mb-2 block text-sm font-medium text-ink-700">Total price</label>
            <div className="flex items-center gap-2 rounded-lg border border-ink-900/15 px-3 py-2.5 focus-within:outline focus-within:outline-2 focus-within:outline-ink-900">
              <span className="num text-sm text-ink-500">₦</span>
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="0"
                autoFocus
                className="num w-full text-sm outline-none"
              />
            </div>
          </Card>
        )}

        {step === 'Deposit' && (
          <Card className="p-5">
            <DepositSlider value={draft.depositPct} onChange={(v) => setDraft({ ...draft, depositPct: v })} recommended={recommended} />
          </Card>
        )}

        {step === 'Costs' && (
          <Card className="space-y-3 p-5">
            {draft.costs.map((cost, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={cost.label}
                  onChange={(e) => updateCostRow(i, 'label', e.target.value)}
                  placeholder="Cost label"
                  className="flex-1 rounded-lg border border-ink-900/15 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900"
                />
                <input
                  type="number"
                  value={cost.amount}
                  onChange={(e) => updateCostRow(i, 'amount', e.target.value)}
                  placeholder="₦0"
                  className="num w-28 rounded-lg border border-ink-900/15 px-3 py-2 text-right text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900"
                />
              </div>
            ))}
            <Button variant="ghost" onClick={addCostRow} className="!px-0">
              + Add cost
            </Button>
          </Card>
        )}

        {step === 'Review' && impact && (
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-700">Before you start</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <StatLabel>Revenue</StatLabel>
                <div className="num text-lg font-medium">{formatNaira(revenue)}</div>
              </div>
              <div>
                <StatLabel>Upfront exposure</StatLabel>
                <div className="num text-lg font-medium text-thread-600">{formatNaira(impact.upfrontExposure)}</div>
              </div>
              <div>
                <StatLabel>Expected profit</StatLabel>
                <div className="num text-lg font-medium text-verified-600">{formatNaira(profit)}</div>
              </div>
              <div>
                <StatLabel>Projected cash gap</StatLabel>
                <div className="num text-lg font-medium">{impact.cashGap > 0 ? formatNaira(impact.cashGap) : 'None'}</div>
              </div>
            </div>
          </Card>
        )}
      </motion.div>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={back} disabled={stepIndex === 0}>
          Back
        </Button>
        <Button onClick={next} disabled={!canContinue}>
          {step === 'Review' ? 'Create project' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/primitives';
import { cn } from '../lib/cn';
import {
  CRAFTS,
  CHARGE_STYLES,
  DEPOSIT_OPTIONS,
  initialAnswers,
  type OnboardingAnswers,
} from '../features/onboarding/types';

const TOTAL_STEPS = 4;

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [done, setDone] = useState(false);
  const router = useRouter();

  function update<K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else setDone(true);
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  const canContinue =
    (step === 1 && answers.craft !== null) ||
    (step === 2 && answers.chargeStyle !== null) ||
    (step === 3 && answers.typicalDeposit !== null && (answers.typicalDeposit !== 'custom' || answers.customDeposit !== '')) ||
    (step === 4 && answers.startingCash !== '');

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bone-50 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl text-ink-900 sm:text-4xl">Your workspace is ready.</h1>
          <p className="mt-2 text-sm text-ink-500">CREW is set up around how {answers.craft?.toLowerCase() ?? 'you'} actually work.</p>
          <Button className="mt-8" onClick={() => router.push('/app')}>
            Go to my workspace
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bone-50 px-6 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="mb-10 flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full', i < step ? 'bg-ink-900' : 'bg-ink-900/10')} />
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
          {step === 1 && (
            <Step title="What do you create?">
              <OptionGrid options={CRAFTS} selected={answers.craft} onSelect={(v) => update('craft', v)} />
            </Step>
          )}

          {step === 2 && (
            <Step title="How do you usually charge?">
              <OptionList options={CHARGE_STYLES} selected={answers.chargeStyle} onSelect={(v) => update('chargeStyle', v)} />
            </Step>
          )}

          {step === 3 && (
            <Step title="What deposit do you usually request?">
              <div className="grid grid-cols-4 gap-2">
                {DEPOSIT_OPTIONS.map((opt) => (
                  <button
                    key={String(opt)}
                    onClick={() => update('typicalDeposit', opt)}
                    className={cn(
                      'rounded-lg border px-2 py-3 text-sm font-medium transition-colors',
                      answers.typicalDeposit === opt ? 'border-ink-900 bg-ink-900 text-bone-50' : 'border-ink-900/15 text-ink-700 hover:border-ink-900/30',
                    )}
                  >
                    {opt === 'custom' ? 'Custom' : `${opt}%`}
                  </button>
                ))}
              </div>
              {answers.typicalDeposit === 'custom' && (
                <input
                  type="number"
                  placeholder="Deposit %"
                  value={answers.customDeposit}
                  onChange={(e) => update('customDeposit', e.target.value)}
                  className="mt-3 w-full rounded-lg border border-ink-900/15 px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900"
                />
              )}
            </Step>
          )}

          {step === 4 && (
            <Step title="Typical cash available before a new project">
              <div className="flex items-center gap-2 rounded-lg border border-ink-900/15 px-3 py-2.5 focus-within:outline focus-within:outline-2 focus-within:outline-ink-900">
                <span className="num text-sm text-ink-500">₦</span>
                <input
                  type="number"
                  placeholder="0"
                  value={answers.startingCash}
                  onChange={(e) => update('startingCash', e.target.value)}
                  className="num w-full text-sm outline-none"
                  autoFocus
                />
              </div>
            </Step>
          )}
        </motion.div>
      </div>

      <div className="mx-auto flex w-full max-w-md justify-between pt-6">
        <Button variant="ghost" onClick={back} disabled={step === 1}>
          Back
        </Button>
        <Button onClick={next} disabled={!canContinue}>
          {step === TOTAL_STEPS ? 'Finish' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-ink-900 sm:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

function OptionGrid<T extends string>({ options, selected, onSelect }: { options: readonly T[]; selected: T | null; onSelect: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={cn(
            'rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
            selected === opt ? 'border-ink-900 bg-ink-900 text-bone-50' : 'border-ink-900/15 text-ink-700 hover:border-ink-900/30',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function OptionList<T extends string>({ options, selected, onSelect }: { options: readonly T[]; selected: T | null; onSelect: (v: T) => void }) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={cn(
            'block w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
            selected === opt ? 'border-ink-900 bg-ink-900 text-bone-50' : 'border-ink-900/15 text-ink-700 hover:border-ink-900/30',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

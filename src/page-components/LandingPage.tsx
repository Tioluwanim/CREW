'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button, Card, Pill } from '../components/ui/primitives';
import { ScrollProgressBar } from '../components/landing/ScrollProgressBar';
import { DepositSlider } from '../components/forms/DepositSlider';
import { formatNaira, formatNairaCompact, formatNairaSigned } from '../lib/money';
import { asoEbiProject, demoFeedback } from '../data/demoData';
import { useLenisScroll } from '../hooks/useLenisScroll';
import { useGsapReveal } from '../hooks/useGsapReveal';
import { useScrollProgress } from '../hooks/useScrollProgress';
import {
  buildCashFlowProjection,
  calculateDepositImpact,
  calculateExpectedProfit,
  recommendMinimumSafeDeposit,
  sumCreatorFundedCosts,
} from '../lib/finance';

const HeroScene = lazy(() => import('../components/landing/HeroScene').then((m) => ({ default: m.HeroScene })));

export function LandingExperience() {
  useLenisScroll();

  return (
    <>
      <ScrollProgressBar />
      <OpeningScene />
      <ProblemScene />
      <IntroScene />
      <InteractiveDemo />
      <TrustSection />
      <UserVoices />
      <PricingSection />
      <FinalCTA />
    </>
  );
}

// ---------------------------------------------------------------------------
// Scene 1 — cinematic opening. GSAP + ScrollTrigger drives every reveal;
// Lenis (mounted once in LandingPage) smooths the scroll it's tied to.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Scene 1 — cinematic opening. Text beats are the same 5 beats the R3F
// scene animates against; both read the same scroll-progress value (see
// useScrollProgress) so they can never drift out of lockstep.
// ---------------------------------------------------------------------------

const BEAT_TEXTS = [
  { text: 'You got the job.', range: [0, 0.2] as const },
  { text: 'You bought the materials.', range: [0.2, 0.45] as const },
  { text: 'You paid the tailor.', range: [0.45, 0.65] as const },
  { text: 'You delivered.', range: [0.65, 0.8] as const },
  { text: 'But where did the money go?', range: [0.8, 1] as const, big: true, holdAtEnd: true },
];

function beatOpacity(progress: number, [start, end]: readonly [number, number], holdAtEnd = false) {
  const fadeInEnd = start + (end - start) * 0.3;
  const fadeOutStart = end - (end - start) * 0.2;
  if (progress < start) return 0;
  if (start === 0 && progress === 0) return 1;
  if (progress < fadeInEnd) return (progress - start) / (fadeInEnd - start);
  if (progress < fadeOutStart) return 1;
  if (progress < end) return holdAtEnd ? 1 : 1 - (progress - fadeOutStart) / (end - fadeOutStart);
  return holdAtEnd ? 1 : 0;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = () => setReduced(query.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return reduced;
}

function OpeningScene() {
  const reducedMotion = usePrefersReducedMotion();
  return reducedMotion ? <StaticOpeningScene /> : <PinnedOpeningScene />;
}

/** Reduced-motion / no-3D fallback: the original simple stacked-reveal version, no pinning or scene. */
function StaticOpeningScene() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.16, y: 10, duration: 0.8, ease: 'power2.out' });
  return (
    <section className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-6 py-24 sm:px-8" ref={ref}>
      <div className="space-y-3">
        {BEAT_TEXTS.slice(0, 4).map((beat) => (
          <p key={beat.text} data-reveal className="font-display text-2xl text-ink-500 sm:text-3xl">
            {beat.text}
          </p>
        ))}
      </div>
      <p data-reveal className="mt-8 font-display text-4xl leading-tight text-ink-900 sm:text-6xl">
        {BEAT_TEXTS[4].text}
      </p>
    </section>
  );
}

/** Full cinematic version: a pinned tall section, scroll-scrubbed, with the procedural R3F scene behind the text. */
function PinnedOpeningScene() {
  const { containerRef, progress } = useScrollProgress<HTMLDivElement>();

  return (
    <section ref={containerRef} className="relative" style={{ height: '400vh' }}>
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <Suspense fallback={null}>
            <HeroScene progress={progress} />
          </Suspense>
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-5 text-center sm:px-8">
          {BEAT_TEXTS.map((beat) =>
            beat.big ? (
              <div
                key={beat.text}
                className="absolute left-1/2 w-[min(90vw,48rem)] -translate-x-1/2 font-display text-[clamp(2rem,8vw,3.75rem)] leading-[1.04] text-ink-900 text-balance"
              >
                {beat.text.split(' ').map((word, i, arr) => {
                  const wordOffset = i * 0.015;
                  const wordRange = [beat.range[0] + wordOffset, Math.min(beat.range[1], beat.range[0] + wordOffset + 0.14)] as const;
                  return (
                    <span
                      key={i}
                      className="inline-block"
                      style={{ opacity: beatOpacity(progress, wordRange, beat.holdAtEnd) }}
                    >
                      {word}
                      {i < arr.length - 1 ? '\u00A0' : ''}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p
                key={beat.text}
                className="absolute left-1/2 w-[min(86vw,36rem)] -translate-x-1/2 font-display text-[clamp(1.35rem,4vw,1.875rem)] leading-tight text-ink-500 text-balance"
                style={{ opacity: beatOpacity(progress, beat.range, beat.holdAtEnd) }}
              >
                {beat.text}
              </p>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/** Splits text into per-word spans for a word-cascade reveal — used sparingly, only on the two most important lines. */
function splitWords(text: string) {
  return text.split(' ').map((word, i, arr) => (
    <span key={i} className="inline-block" data-reveal>
      {word}
      {i < arr.length - 1 ? '\u00A0' : ''}
    </span>
  ));
}

function ProblemScene() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.12, x: -18, y: 4, duration: 0.5, ease: 'power2.out' });
  const headlineRef = useGsapReveal<HTMLDivElement>({ stagger: 0.025, y: 22, start: 'top 75%', duration: 1.1, ease: 'expo.out' });
  const costs = asoEbiProject.costs;
  const revenue = asoEbiProject.revenue;
  const impact = calculateDepositImpact(costs, revenue, asoEbiProject.depositPct, asoEbiProject.expectedPaymentDays);

  const rows = [
    { label: 'Revenue', value: revenue, positive: true },
    ...costs.map((c) => ({ label: c.label, value: -c.amount, positive: false })),
  ];

  return (
    <section className="atelier-ink border-t border-ink-900/5 px-6 py-24 text-bone-50 sm:px-8" ref={ref}>
      <div className="mx-auto max-w-2xl">
        <p data-reveal className="mb-8 text-sm font-medium uppercase tracking-wide text-bone-200/50">
          The Aso-ebi order
        </p>

        <div className="space-y-3 border-t border-white/10 pt-6">
          {rows.map((row) => (
            <div key={row.label} data-reveal className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-bone-200/80">{row.label}</span>
              <span className={`num text-lg ${row.positive ? 'text-verified-100' : 'text-bone-200/70'}`}>
                {row.positive ? formatNaira(row.value) : `-${formatNaira(Math.abs(row.value))}`}
              </span>
            </div>
          ))}
        </div>

        <div data-reveal className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Metric label="Upfront exposure" value={formatNaira(impact.upfrontExposure)} accent />
          <Metric label="Client payment" value={`${asoEbiProject.expectedPaymentDays} days`} />
          <Metric label="Projected cash gap" value={formatNaira(impact.cashGap)} accent />
        </div>

        <div ref={headlineRef} className="mt-14 font-display text-3xl leading-snug sm:text-4xl">
          {splitWords('The project was profitable.')}
          <br />
          <span className="text-bone-200/60">{splitWords('The problem was getting there.')}</span>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs text-bone-200/50">{label}</div>
      <div className={`num mt-1 text-xl font-medium ${accent ? 'text-gold-500' : 'text-bone-50'}`}>{value}</div>
    </div>
  );
}

function IntroScene() {
  const ref = useGsapReveal<HTMLDivElement>();
  return (
    <section className="atelier-ink px-6 pb-28 pt-4 text-bone-50 sm:px-8" ref={ref}>
      <div data-reveal className="mx-auto max-w-2xl text-center">
        <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-gold-500">
          <Sparkles size={15} /> Meet CREW
        </p>
        <h2 className="font-display text-4xl leading-tight sm:text-5xl">The money workspace behind every project.</h2>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-bone-200/60">
          See what each project needs before the work begins, then keep the money moving while you make it happen.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Interactive demo — the judge-facing core experience, no account required.
// Product UI transitions here (slider value, invoice reveal, payment
// verification) use Framer Motion, per the brief's animation-system split.
// ---------------------------------------------------------------------------

function InteractiveDemo() {
  const [depositPct, setDepositPct] = useState(asoEbiProject.depositPct);
  const [costs, setCosts] = useState(asoEbiProject.costs);
  const [invoiceGenerated, setInvoiceGenerated] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  const revenue = asoEbiProject.revenue;
  const impact = calculateDepositImpact(costs, revenue, depositPct, asoEbiProject.expectedPaymentDays);
  const profit = calculateExpectedProfit(costs, revenue);
  const recommended = recommendMinimumSafeDeposit(costs, revenue);
  const forecast = buildCashFlowProjection(costs, revenue, depositPct, asoEbiProject.expectedPaymentDays, 0);
  const currentCashPosition = paymentVerified ? profit : impact.depositAmount - sumCreatorFundedCosts(costs);

  function updateCostAmount(id: string, amount: number) {
    setCosts((prev) => prev.map((c) => (c.id === id ? { ...c, amount: Math.max(0, amount) } : c)));
  }

  return (
    <section className="atelier-table border-t border-ink-900/5 px-6 py-24 sm:px-8" id="demo">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl sm:text-4xl">Try it with Amara's project</h2>
          <p className="mt-2 text-sm text-ink-500">This demo uses sample business data — no account needed.</p>
        </div>

        <Card className="p-5 sm:p-7">
          {/* Step 1: project */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Project</div>
              <h3 className="font-display text-2xl">{asoEbiProject.name}</h3>
              <p className="text-sm text-ink-500">{asoEbiProject.clientName} · Fashion project</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-ink-500">Revenue</div>
              <div className="num text-xl font-medium">{formatNaira(revenue)}</div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {costs.map((c) => (
              <label key={c.id} className="block rounded-lg bg-bone-100/70 p-3 transition-colors focus-within:bg-bone-100">
                <div className="text-xs text-ink-500">{c.label}</div>
                <div className="mt-0.5 flex items-baseline gap-0.5">
                  <span className="num text-xs text-ink-400">₦</span>
                  <input
                    type="number"
                    value={c.amount}
                    onChange={(e) => updateCostAmount(c.id, Number(e.target.value))}
                    aria-label={`${c.label} amount`}
                    className="num w-full min-w-0 bg-transparent font-medium text-ink-900 outline-none"
                  />
                </div>
              </label>
            ))}
          </div>
          <p className="-mt-4 mb-6 text-xs text-ink-500">Try editing a cost — everything below updates with it.</p>

          {/* Step 2 + 3: financial result + deposit slider */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ResultStat label="Upfront exposure" value={formatNaira(impact.upfrontExposure)} tone="thread" />
            <ResultStat label="Cash gap" value={formatNaira(impact.cashGap)} tone="thread" />
            <ResultStat label="Expected profit" value={formatNaira(profit)} tone="verified" />
            <ResultStat label="Days to cash" value={`${asoEbiProject.expectedPaymentDays}`} />
          </div>

          <div className="mb-6 rounded-xl border border-ink-900/10 p-4">
            <DepositSlider value={depositPct} onChange={setDepositPct} recommended={recommended} />
            <p className="mt-3 text-xs text-ink-500">Moving the deposit changes your exposure and gap in real time.</p>
          </div>

          <div className="mb-6 rounded-xl border border-ink-900/10 bg-bone-100/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Cash forecast</div>
                <div className="text-sm text-ink-700">How this project moves your cash before the balance arrives.</div>
              </div>
              <div className={`num text-sm font-medium ${currentCashPosition < 0 ? 'text-thread-600' : 'text-verified-600'}`}>
                {formatNairaSigned(currentCashPosition)} now
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {forecast.map((point) => (
                <div key={point.label} className="min-w-0">
                  <div className="mb-1 text-[10px] text-ink-500">{point.label.replace(' days', 'd')}</div>
                  <div className={`num truncate text-xs font-medium ${point.projectedBalance < 0 ? 'text-thread-600' : 'text-verified-600'}`}>
                    {formatNairaCompact(point.projectedBalance)}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-ink-900/10">
                    <motion.div
                      key={`${point.label}-${point.projectedBalance}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(12, (Math.abs(point.projectedBalance) / revenue) * 100))}%` }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className={`h-1.5 rounded-full ${point.projectedBalance < 0 ? 'bg-thread-600' : 'bg-verified-600'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: recommendation */}
          {recommended !== null && depositPct < recommended && (
            <div className="mb-6 rounded-xl border border-gold-500/30 bg-gold-100/60 p-4">
              <p className="text-sm font-medium text-ink-900">Recommended deposit: {recommended}%</p>
              <p className="mt-1 text-sm text-ink-700">This deposit covers your upfront costs with a safer buffer.</p>
            </div>
          )}
          {recommended !== null && depositPct >= recommended && (
            <div className="mb-6 rounded-xl border border-verified-600/20 bg-verified-100/60 p-4 text-sm text-verified-600">
              This deposit covers your upfront costs. No cash gap for this project.
            </div>
          )}

          {/* Step 5: invoice */}
          <div className="mb-6 border-t border-ink-900/10 pt-6">
            {!invoiceGenerated ? (
              <Button onClick={() => setInvoiceGenerated(true)}>Generate invoice</Button>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-ink-900/10 bg-bone-100/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Invoice preview</span>
                    <Pill>Not sent yet</Pill>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <Row label="Client" value={asoEbiProject.clientName} />
                    <Row label="Amount" value={formatNaira(revenue)} />
                    <Row label="Deposit" value={`${depositPct}% · ${formatNaira(impact.depositAmount)}`} />
                    <Row label="Balance" value={formatNaira(revenue - impact.depositAmount)} />
                    <Row label="Due" value={`${asoEbiProject.expectedPaymentDays} days after delivery`} />
                  </div>
                </div>
                <div className="rounded-xl border border-verified-600/20 bg-verified-100/40 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-verified-600">WhatsApp-ready</p>
                  <p className="text-sm text-ink-700">
                    "Hi {asoEbiProject.clientName}, here's your invoice for the {asoEbiProject.name.toLowerCase()} — {formatNaira(revenue)} total, {formatNaira(impact.depositAmount)} deposit to start. CREW link: crew.app/pay/asoebi"
                  </p>
                </div>

                {/* Step 6: simulated payment */}
                {!paymentVerified ? (
                  <Button variant="secondary" onClick={() => setPaymentVerified(true)}>
                    Simulate client payment
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-verified-600/30 bg-verified-100/60 p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Pill tone="verified">Verified</Pill>
                      <span className="text-sm text-ink-700">Payment received</span>
                    </div>
                    <p className="text-sm text-verified-600">
                      Cash position: {formatNaira(currentCashPosition)}. Expected profit: {formatNaira(profit)}. Project status: paid.
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          <div className="text-center">
            <Link href="/demo" className="text-sm font-medium text-ink-700 underline underline-offset-4 hover:text-ink-900">
              Open the full workspace demo →
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
}

function ResultStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'thread' | 'verified' }) {
  const toneClass = tone === 'thread' ? 'text-thread-600' : tone === 'verified' ? 'text-verified-600' : 'text-ink-900';
  return (
    <div className="rounded-xl border border-ink-900/10 p-3.5">
      <div className="text-xs text-ink-500">{label}</div>
      <motion.div
        key={value}
        initial={{ opacity: 0.35, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`num text-lg font-medium ${toneClass}`}
      >
        {value}
      </motion.div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}

function UserVoices() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.14, x: 24, y: 0, duration: 0.75, ease: 'back.out(1.25)' });
  return (
    <section className="atelier-table border-t border-ink-900/5 px-6 py-20 sm:px-8 sm:py-24" ref={ref}>
      <div className="mx-auto max-w-4xl">
        <p data-reveal className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-thread-600">
          A clearer way to work
        </p>
        <h2 data-reveal className="mb-3 max-w-xl font-display text-3xl leading-tight sm:text-4xl">
          Keep the project moving without guessing about the money.
        </h2>
        <p data-reveal className="mb-10 text-sm text-ink-500">
          Sample feedback for this demo — real user comments will replace these. Every voice points to the same gap: knowing the margin is not the same as knowing when cash is available.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {demoFeedback.map((f) => (
            <div key={f.id} data-reveal className="rounded-xl border border-ink-900/10 bg-white p-5">
              <p className="mb-4 text-sm leading-relaxed text-ink-700">"{f.quote}"</p>
              <div className="text-xs text-ink-500">
                {f.craft} · {f.location}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-300">{f.source}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.06, y: 6, start: 'top 72%', duration: 0.42, ease: 'power1.out' });
  return (
    <section className="border-t border-ink-900/5 px-6 py-24 sm:px-8" ref={ref}>
      <div className="mx-auto max-w-2xl">
        <h2 data-reveal className="mb-10 font-display text-3xl">
          Nothing happens without you
        </h2>
        <div className="space-y-4">
          <TrustCard title="Invoice approval" body="CREW prepared this invoice. Nothing has been sent yet." />
          <TrustCard title="Manual payments" body="You marked this payment manually. CREW will keep it unverified until confirmed by a real payment." />
          <TrustCard title="Your data" body="Project activity, payment activity, and business patterns stay yours. You choose what, if anything, gets shared — and you can revoke access anytime." />
        </div>
      </div>
    </section>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <div data-reveal className="rounded-xl border border-ink-900/10 bg-white p-5">
      <h3 className="mb-1 text-sm font-medium text-ink-900">{title}</h3>
      <p className="text-sm text-ink-500">{body}</p>
    </div>
  );
}

function PricingSection() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.18, x: -14, y: 0, duration: 0.9, ease: 'power2.inOut' });
  return (
    <section className="atelier-paper border-t border-ink-900/5 bg-gold-100/45 px-6 py-20 sm:px-8 sm:py-24" ref={ref}>
      <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p data-reveal className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-ink-700">Start with the work</p>
          <h2 data-reveal className="max-w-xl font-display text-3xl leading-tight sm:text-4xl">A workspace for the money side of making things.</h2>
          <p data-reveal className="mt-3 max-w-lg text-sm leading-relaxed text-ink-700">Explore the demo with sample data, or build a workspace around your own projects.</p>
        </div>
        <div data-reveal className="flex flex-wrap gap-3 sm:justify-end">
          <Link href="/demo">
            <Button variant="secondary">Explore the demo</Button>
          </Link>
          <Link href="/onboarding">
            <Button>Build my workspace</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.04, y: 0, duration: 1.2, ease: 'power4.out' });
  return (
    <section className="atelier-ink border-t border-ink-900/5 px-6 py-28 text-center text-bone-50 sm:px-8" ref={ref}>
      <div data-reveal className="mx-auto max-w-xl">
        <p className="font-display text-3xl sm:text-4xl">You already run the project.</p>
        <p className="mt-2 font-display text-3xl text-bone-200/60 sm:text-4xl">CREW helps you run what happens around the money.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/onboarding">
            <Button className="!bg-gold-500 !text-ink-950 hover:!bg-gold-500/90">Build my workspace</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}


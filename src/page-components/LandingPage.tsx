'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowRight, Check, CircleAlert, LockKeyhole, Sparkles } from 'lucide-react';
import { Button, Card, Pill } from '../components/ui/primitives';
import { DepositSlider } from '../components/forms/DepositSlider';
import { FloatingNav } from '../components/layout/FloatingNav';
import { useLenisScroll } from '../hooks/useLenisScroll';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { formatNaira, formatNairaCompact } from '../lib/money';
import { kemiProject, demoFeedback } from '../data/demoData';
import {
  buildCashFlowProjection,
  calculateDepositImpact,
  calculateExpectedProfit,
  recommendMinimumSafeDeposit,
} from '../lib/finance';

const HeroScene = dynamic(
  () => import('../components/landing/HeroScene').then((module) => module.HeroScene),
  { ssr: false, loading: () => <SceneFallback /> },
);

export function LandingExperience() {
  useLenisScroll();

  return (
    <>
      <FloatingNav />
      <Hero />
      <TrustRail />
      <WorkflowStory />
      <InteractiveDemo />
      <ProofSection />
      <FinalCTA />
    </>
  );
}

function Hero() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <section className="px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:pb-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
        <div>
          <Pill tone="gold">The money workspace for independent creators</Pill>
          <h1 className="mt-7 max-w-3xl font-display text-[clamp(3.7rem,8vw,8rem)] leading-[0.86] tracking-[-0.065em] text-ink-900">
            Make the work.
            <br />
            <span className="text-thread-600">Keep the clarity.</span>
          </h1>
          <p className="mt-8 max-w-lg text-base leading-relaxed text-ink-600 sm:text-lg">
            CREW keeps your brief, changes, costs, client approval, and payment in one calm project thread — so the creative work can stay creative.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-bone-50 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
              Walk through a real deal <ArrowRight size={16} />
            </Link>
            <a href="#workflow" className="inline-flex items-center gap-2 rounded-full border border-ink-900/15 px-5 py-3 text-sm font-medium text-ink-800 hover:border-ink-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
              See how it works <ArrowDownRight size={16} />
            </a>
          </div>
          <div className="mt-10 flex items-center gap-3 text-xs text-ink-500">
            <span className="flex -space-x-2" aria-hidden="true">
              {['K', 'A', 'M'].map((letter) => <span key={letter} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-bone-50 bg-ink-900 text-[10px] text-bone-50">{letter}</span>)}
            </span>
            <span>Built for the person behind the deliverable.</span>
          </div>
        </div>
        <HeroStage reducedMotion={reducedMotion} />
      </div>
    </section>
  );
}

function HeroStage({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="relative">
      <div className="absolute -right-8 -top-8 h-52 w-52 rounded-full bg-gold-100 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2rem] border border-ink-900/10 bg-ink-950 p-3 shadow-[0_30px_90px_-30px_rgba(20,23,31,0.45)] sm:p-5">
        <div className="relative aspect-[1.15] overflow-hidden rounded-[1.4rem] border border-bone-50/10 bg-ink-900">
          <div className="absolute inset-x-5 top-5 z-10 flex items-center justify-between text-bone-50">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-bone-200/50">Project film · 01</p>
              <p className="mt-1 font-display text-2xl">Lumo Skincare</p>
            </div>
            <Pill tone="verified">In progress</Pill>
          </div>
          <div className="absolute inset-0 opacity-80" aria-hidden="true">
            {reducedMotion ? <SceneFallback dark /> : <HeroScene progress={0.18} />}
          </div>
          <div className="absolute inset-x-5 bottom-5 z-10 grid grid-cols-3 gap-2">
            <StageStat label="Project value" value="₦300k" />
            <StageStat label="Deposit" value="40%" />
            <StageStat label="Next move" value="Agree" accent />
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-ink-900/10 bg-bone-50 px-4 py-3 shadow-[var(--shadow-ledger)] sm:block">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500">Client payment</p>
        <p className="num mt-1 text-sm text-verified-600">Held safely</p>
      </div>
    </div>
  );
}

function StageStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-bone-50/10 bg-ink-950/70 p-3 backdrop-blur-sm">
      <p className="text-[10px] text-bone-200/50">{label}</p>
      <p className={`num mt-1 text-sm ${accent ? 'text-gold-500' : 'text-bone-50'}`}>{value}</p>
    </div>
  );
}

function SceneFallback({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`h-full w-full ${dark ? 'bg-ink-900' : 'bg-bone-100'} p-5`} aria-hidden="true">
      <div className={`h-full rounded-[1.2rem] border ${dark ? 'border-bone-50/10 bg-ink-800' : 'border-ink-900/10 bg-bone-50'} p-6`}>
        <div className={`h-2 w-1/3 rounded-full ${dark ? 'bg-gold-500/70' : 'bg-gold-500'}`} />
        <div className="mt-20 flex items-end justify-center gap-3">
          {[0.45, 0.7, 0.56, 0.9, 0.65].map((height, index) => <div key={index} className={`w-8 rounded-t-full ${index === 3 ? 'bg-thread-600' : 'bg-gold-500/70'}`} style={{ height: `${height * 120}px` }} />)}
        </div>
        <div className={`mx-auto mt-6 h-1.5 w-2/3 rounded-full ${dark ? 'bg-bone-50/15' : 'bg-ink-900/10'}`} />
      </div>
    </div>
  );
}

function TrustRail() {
  return (
    <section className="border-y border-ink-900/10 bg-bone-100/60 px-5 py-6 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-3 sm:gap-8">
        {[
          ['01', 'Agree clearly', 'Lock the scope before the first deliverable.'],
          ['02', 'Keep the thread', 'Record every change where both sides can see it.'],
          ['03', 'Release with trust', 'Approval comes before creator payout.'],
        ].map(([number, title, body]) => (
          <div key={number} className="flex gap-3">
            <span className="num text-xs text-thread-600">{number}</span>
            <div><p className="text-sm font-medium text-ink-900">{title}</p><p className="mt-1 text-sm text-ink-500">{body}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkflowStory() {
  const { containerRef, progress } = useScrollProgress<HTMLDivElement>();
  const chapter = progress < 0.27 ? 0 : progress < 0.53 ? 1 : progress < 0.77 ? 2 : 3;
  const chapters = [
    { eyebrow: '01 · The brief', title: 'Start with a clear yes.', body: 'Put the deliverables, timeline, and price in one shared place before the first frame is made.' },
    { eyebrow: '02 · The change', title: 'Make “one more” visible.', body: 'When the brief changes, CREW captures the request before it becomes a quiet source of tension.' },
    { eyebrow: '03 · The decision', title: 'Included, or extra?', body: 'Both sides see the same scope. One decision replaces a long thread of assumptions.' },
    { eyebrow: '04 · The handoff', title: 'Approval first. Payout after.', body: 'The money stays held until the work is approved. Clarity protects the creator and the client.' },
  ];

  return (
    <section id="workflow" ref={containerRef} className="relative h-[320vh] border-b border-ink-900/10 bg-ink-950 text-bone-50">
      <div className="sticky top-0 flex min-h-screen items-center px-5 py-16 sm:px-8">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="relative z-10">
            <Pill tone="gold">One project, one visible story</Pill>
            <AnimatePresence mode="wait">
              <motion.div key={chapter} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.35 }}>
                <p className="mt-10 text-xs uppercase tracking-[0.2em] text-gold-500">{chapters[chapter].eyebrow}</p>
                <h2 className="mt-4 max-w-xl font-display text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">{chapters[chapter].title}</h2>
                <p className="mt-6 max-w-md text-base leading-relaxed text-bone-200/60">{chapters[chapter].body}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-10 flex gap-2" aria-label={`Story progress: ${chapter + 1} of 4`}>
              {chapters.map((item, index) => <span key={item.eyebrow} className={`h-1.5 flex-1 rounded-full transition-colors ${index <= chapter ? 'bg-gold-500' : 'bg-bone-50/15'}`} />)}
            </div>
          </div>
          <WorkflowBoard progress={progress} />
        </div>
      </div>
    </section>
  );
}

function WorkflowBoard({ progress }: { progress: number }) {
  const resolved = progress > 0.78;
  const extra = progress > 0.5;
  return (
    <div className="relative min-h-[27rem] rounded-[2rem] border border-bone-50/10 bg-ink-900/70 p-4 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.7)] sm:p-7">
      <div className="flex items-center justify-between border-b border-bone-50/10 pb-5">
        <div><p className="text-[10px] uppercase tracking-[0.2em] text-bone-200/45">Active project</p><h3 className="mt-1 font-display text-3xl">Lumo Skincare</h3></div>
        <Pill tone={resolved ? 'verified' : extra ? 'thread' : 'gold'}>{resolved ? 'Approved' : extra ? 'Needs a decision' : 'In progress'}</Pill>
      </div>
      <div className="grid gap-3 py-6 sm:grid-cols-3">
        <BoardStat label="Project value" value={extra && resolved ? '₦330k' : '₦300k'} />
        <BoardStat label="Deliverables" value={extra ? '6 pieces' : '5 pieces'} />
        <BoardStat label="Payment" value={resolved ? 'Released' : 'Held safely'} />
      </div>
      <div className={`rounded-2xl border p-5 transition-colors ${extra && !resolved ? 'border-thread-600/50 bg-thread-600/10' : resolved ? 'border-verified-600/40 bg-verified-600/10' : 'border-gold-500/30 bg-gold-500/10'}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 rounded-full p-2 ${resolved ? 'bg-verified-600/20 text-verified-100' : extra ? 'bg-thread-600/20 text-thread-100' : 'bg-gold-500/20 text-gold-100'}`}><CircleAlert size={16} /></span>
          <div><p className="text-xs uppercase tracking-[0.15em] text-bone-200/50">{resolved ? 'Settled change' : 'New request'}</p><p className="mt-1 text-sm text-bone-50">{resolved ? 'One more TikTok — approved as an extra.' : '“Can you add one more TikTok?”'}</p></div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          {['Brief', 'Change', 'Approval', 'Paid'].map((step, index) => <div key={step} className="flex flex-1 items-center gap-2"><span className={`h-2 w-2 rounded-full ${index < (resolved ? 4 : extra ? 2 : 1) ? 'bg-gold-500' : 'bg-bone-50/20'}`} /><span className="hidden text-[10px] text-bone-200/50 sm:inline">{step}</span>{index < 3 && <span className="h-px flex-1 bg-bone-50/10" />}</div>)}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-bone-200/45"><span>CREW keeps the context attached to the money.</span><span className="num text-bone-50">{Math.round(progress * 100)}%</span></div>
    </div>
  );
}

function BoardStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-bone-50/10 bg-bone-50/5 p-3"><p className="text-[11px] text-bone-200/45">{label}</p><p className="num mt-1 text-lg text-bone-50">{value}</p></div>;
}

export function InteractiveDemo() {
  const [depositPct, setDepositPct] = useState(kemiProject.depositPct);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [classification, setClassification] = useState<'included' | 'extra' | null>(null);
  const [creatorApproved, setCreatorApproved] = useState(false);
  const [clientApproved, setClientApproved] = useState(false);
  const extraAccepted = classification === 'extra' && creatorApproved && clientApproved;
  const revenue = kemiProject.revenue + (extraAccepted ? (kemiProject.changeRequests?.[0]?.priceImpact ?? 0) : 0);
  const impact = calculateDepositImpact(kemiProject.costs, revenue, depositPct, kemiProject.expectedPaymentDays);
  const profit = calculateExpectedProfit(kemiProject.costs, revenue);
  const recommended = recommendMinimumSafeDeposit(kemiProject.costs, revenue);
  const forecast = buildCashFlowProjection(kemiProject.costs, revenue, depositPct, kemiProject.expectedPaymentDays, 0);

  return (
    <section id="demo" className="atelier-table border-b border-ink-900/10 px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Pill tone="thread">Try the real product logic</Pill>
            <h2 className="mt-5 max-w-xl font-display text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">See the money before it moves.</h2>
            <p className="mt-6 max-w-md leading-relaxed text-ink-600">Change the deposit, classify the request, and see how the project’s cash position responds. These figures are calculated live from the same finance engine used in the workspace.</p>
            <div className="mt-8 flex items-center gap-3 text-sm text-ink-500"><LockKeyhole size={16} className="text-verified-600" /> Sample data. No account needed.</div>
          </div>
          <Card className="overflow-hidden p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-900/10 pb-6">
              <div><p className="text-xs uppercase tracking-[0.18em] text-ink-500">Live deal model</p><h3 className="mt-2 font-display text-3xl">{kemiProject.name}</h3><p className="mt-1 text-sm text-ink-500">{kemiProject.clientName} · {kemiProject.craft}</p></div>
              <Pill tone={paymentVerified ? 'verified' : 'gold'}>{paymentVerified ? 'Payment verified' : 'In progress'}</Pill>
            </div>
            <div className="grid gap-3 py-6 sm:grid-cols-3">
              <DemoStat label="Project value" value={formatNaira(revenue)} />
              <DemoStat label="Expected profit" value={formatNaira(profit)} tone="verified" />
              <DemoStat label="Cash gap" value={formatNaira(impact.cashGap)} tone={impact.cashGap > 0 ? 'thread' : 'verified'} />
            </div>
            <div className="border-t border-ink-900/10 pt-6"><DepositSlider value={depositPct} onChange={setDepositPct} recommended={recommended} /></div>
            <div className="mt-8 rounded-2xl border border-gold-500/25 bg-gold-100/45 p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-gold-500">Change request</p><p className="mt-2 text-sm text-ink-800">“Can you add one more TikTok?”</p></div>{classification && <Pill tone={extraAccepted ? 'thread' : 'verified'}>{extraAccepted ? 'Extra · approved' : classification === 'extra' ? 'Extra · needs approval' : 'Included'}</Pill>}</div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant={classification === 'included' ? 'primary' : 'secondary'} onClick={() => { setClassification('included'); setCreatorApproved(false); setClientApproved(false); }}><Check size={15} /> Included — no charge</Button>
                <Button variant={classification === 'extra' ? 'primary' : 'secondary'} onClick={() => setClassification('extra')}>Extra — {formatNaira(kemiProject.changeRequests?.[0]?.priceImpact ?? 0)}</Button>
              </div>
              {classification === 'included' && <p className="mt-4 text-sm text-verified-600">This request is already covered by the original scope. No approval is needed.</p>}
              {classification === 'extra' && !extraAccepted && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gold-500/20 pt-4">
                <Button variant={creatorApproved ? 'primary' : 'secondary'} onClick={() => setCreatorApproved((value) => !value)}>{creatorApproved ? 'You approved' : 'You approve'}</Button>
                <Button variant={clientApproved ? 'primary' : 'secondary'} onClick={() => setClientApproved((value) => !value)}>{clientApproved ? 'Lumo approved' : 'Lumo approves'}</Button>
                <span className="text-xs text-ink-500">Both sides must agree before the total changes.</span>
              </div>}
              {extraAccepted && <p className="mt-4 text-sm text-verified-600">Both sides agreed. The extra is now part of the project total.</p>}
            </div>
            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-ink-800">Cash-flow checkpoints</p><p className="text-xs text-ink-500">Calculated, not illustrative</p></div>
              <div className="grid grid-cols-5 gap-2">
                {forecast.map((point) => <div key={point.label} className="min-w-0"><p className="text-[10px] text-ink-500">{point.label.replace(' days', 'd')}</p><p className={`num mt-1 truncate text-xs ${point.projectedBalance < 0 ? 'text-thread-600' : 'text-verified-600'}`}>{formatNairaCompact(point.projectedBalance)}</p><div className="mt-2 h-1.5 rounded-full bg-ink-900/10"><motion.div animate={{ width: `${Math.min(100, Math.max(10, Math.abs(point.projectedBalance / Math.max(revenue, 1)) * 100))}%` }} className={`h-full rounded-full ${point.projectedBalance < 0 ? 'bg-thread-600' : 'bg-verified-600'}`} /></div></div>)}
              </div>
            </div>
            <div className="mt-8 border-t border-ink-900/10 pt-6">
              {!invoiceOpen ? <Button onClick={() => setInvoiceOpen(true)}>Preview client link <ArrowRight size={15} /></Button> : <div className="space-y-4">
                <div className="rounded-2xl border border-ink-900/10 bg-bone-100/60 p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium">Client link preview</p><Pill>No signup needed</Pill></div><div className="mt-4 space-y-2 text-sm"><SummaryRow label="Amount" value={formatNaira(revenue)} /><SummaryRow label="Deposit" value={`${depositPct}% · ${formatNaira(impact.depositAmount)}`} /><SummaryRow label="Balance" value={formatNaira(revenue - impact.depositAmount)} /><SummaryRow label="Due" value={`${kemiProject.expectedPaymentDays} days after delivery`} /></div></div>
                {!paymentVerified ? <Button variant="secondary" onClick={() => setPaymentVerified(true)}>Simulate client payment</Button> : <div className="rounded-2xl border border-verified-600/25 bg-verified-100/60 p-5"><div className="flex items-center gap-2"><Pill tone="verified">Verified</Pill><span className="text-sm text-ink-700">Payment received</span></div><p className="mt-3 text-sm text-verified-600">Cash position: {formatNaira(profit)}. The client and creator can see the same settled state.</p></div>}
              </div>}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function DemoStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'thread' | 'verified' }) {
  return <div className="rounded-xl border border-ink-900/10 bg-white/60 p-4"><p className="text-xs text-ink-500">{label}</p><p className={`num mt-2 text-xl ${tone === 'thread' ? 'text-thread-600' : tone === 'verified' ? 'text-verified-600' : 'text-ink-900'}`}>{value}</p></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-ink-500">{label}</span><span className="num text-ink-900">{value}</span></div>;
}

function ProofSection() {
  return (
    <section id="voices" className="atelier-paper px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div><Pill tone="gold">A calmer way to work</Pill><h2 className="mt-5 max-w-lg font-display text-5xl leading-[0.95] tracking-[-0.04em]">Margin is not the same as available cash.</h2><p className="mt-6 max-w-md leading-relaxed text-ink-600">CREW is designed around the moments that make independent work feel uncertain: scope drift, upfront costs, slow approvals, and payments that arrive too late.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">
            {demoFeedback.map((feedback) => <Card key={feedback.id} className="p-5"><Sparkles size={16} className="text-gold-500" /><p className="mt-5 text-sm leading-relaxed text-ink-700">“{feedback.quote}”</p><p className="mt-5 text-xs text-ink-500">{feedback.craft} · {feedback.location}</p><p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-ink-300">{feedback.source}</p></Card>)}
          </div>
        </div>
        <div className="mt-20 grid gap-4 border-t border-ink-900/10 pt-8 sm:grid-cols-3">
          <TrustNote title="You approve every step" body="CREW never sends an invoice or marks a payment verified without an explicit action." />
          <TrustNote title="The numbers stay grounded" body="Financial figures come from the same calculation core that powers the workspace." />
          <TrustNote title="No invented integrations" body="Sandbox and demo states are labelled plainly, so you always know what is real." />
        </div>
      </div>
    </section>
  );
}

function TrustNote({ title, body }: { title: string; body: string }) {
  return <div className="flex gap-3"><span className="mt-1 text-verified-600"><Check size={16} /></span><div><h3 className="text-sm font-medium text-ink-900">{title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-500">{body}</p></div></div>;
}

function FinalCTA() {
  return (
    <section className="atelier-ink px-5 py-24 text-bone-50 sm:px-8 lg:py-32">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-10 sm:flex-row sm:items-end">
        <div><p className="text-xs uppercase tracking-[0.2em] text-gold-500">Ready when you are</p><h2 className="mt-5 max-w-2xl font-display text-6xl leading-[0.9] tracking-[-0.05em] sm:text-8xl">Make the next project easier to trust.</h2></div>
        <Link href="/app" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-bone-50 px-5 py-3 text-sm font-medium text-ink-900 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone-50">Open your workspace <ArrowRight size={16} /></Link>
      </div>
    </section>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

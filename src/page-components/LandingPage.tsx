'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Button, Card, Pill } from '../components/ui/primitives';
import { ScrollProgressBar } from '../components/landing/ScrollProgressBar';
import { DepositSlider } from '../components/forms/DepositSlider';
import { formatNaira, formatNairaCompact } from '../lib/money';
import { kemiProject, demoFeedback } from '../data/demoData';
import { kemiPersona } from '../data/demoPersona';
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
import { HERO_BEAT_RANGES } from '../lib/heroBeats';

const HeroScene = dynamic(() => import('../components/landing/HeroScene').then((module) => module.HeroScene), {
  ssr: false,
  loading: () => null,
});

export function LandingExperience() {
  useLenisScroll();

  return (
    <>
      <ScrollProgressBar />
      <CinematicHero />
      <ProofStrip />
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
// Scene 1 — cinematic opening. Text beats read the same shared
// HERO_BEAT_RANGES the R3F scene animates against (src/lib/heroBeats.ts),
// so the two can never drift out of lockstep.
//
// One continuous project arc: agreement -> work -> change -> revision ->
// delivery -> approval -> payment -> financial picture -> prediction.
// ---------------------------------------------------------------------------

const BEAT_TEXTS = [
  { text: 'Lumo Skincare agrees the creator campaign.', range: HERO_BEAT_RANGES.job },
  { text: 'Two looks, a fitting, and launch photos are locked.', range: HERO_BEAT_RANGES.materials },
  { text: `Then: "Can you add one more look?"`, range: HERO_BEAT_RANGES.costs },
  { text: 'The change is recorded before anyone starts guessing.', range: HERO_BEAT_RANGES.deliver },
  { text: 'Included in scope — or extra?', range: HERO_BEAT_RANGES.gap, big: true },
  {
    text: 'CREW keeps both sides aligned \u2014 until approval, payment stays held.',
    range: HERO_BEAT_RANGES.resolve,
    big: true,
    holdAtEnd: true,
  },
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

function CinematicHero() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <section className="relative overflow-hidden px-5 pb-0 pt-5 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative z-30 flex items-center justify-between rounded-full border border-ink-900/10 bg-bone-50/85 px-4 py-3 shadow-[var(--shadow-ledger)] backdrop-blur-md sm:px-6">
          <Link href="/" className="font-display text-xl italic text-ink-900" aria-label="CREW home">CREW</Link>
          <nav className="hidden items-center gap-7 text-sm text-ink-600 md:flex" aria-label="Main navigation">
            <a href="#how-it-works" className="hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900">How it works</a>
            <a href="#demo" className="hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900">See the workspace</a>
            <a href="#voices" className="hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900">For creators</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/demo" className="hidden px-3 py-2 text-sm font-medium text-ink-700 sm:block">Explore demo</Link>
            <Link href="/app" className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-bone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">Open workspace</Link>
          </div>
        </header>
      </div>
      {reducedMotion ? <CinematicStoryStatic /> : <CinematicStory />}
    </section>
  );
}

function CinematicStoryStatic() {
  return (
    <div className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 py-20 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <Pill tone="gold">A creator deal, without the guesswork</Pill>
        <h1 className="mt-6 max-w-xl font-display text-[clamp(3.3rem,7vw,6.8rem)] leading-[0.9] tracking-[-0.055em] text-ink-900">Make the work.<br /><span className="text-thread-600">Keep the clarity.</span></h1>
        <p className="mt-7 max-w-md text-base leading-relaxed text-ink-600 sm:text-lg">Kemi&apos;s Lumo campaign, from agreement to approval, in one visible project story.</p>
        <Link href="/demo" className="mt-8 inline-flex rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-bone-50">Walk through the deal</Link>
      </div>
      <CreatorProjectScene progress={0.86} />
    </div>
  );
}

function CinematicStory() {
  const { containerRef, progress } = useScrollProgress<HTMLDivElement>();
  const stages = [
    { range: [0, 0.22] as const, eyebrow: 'Scene 01 · The brief', title: 'A good deal starts with a clear yes.', body: 'Lumo Skincare and Kemi agree what the campaign includes before the first frame is made.' },
    { range: [0.22, 0.48] as const, eyebrow: 'Scene 02 · The ask', title: 'Then the brief changes.', body: '“Can you add one more TikTok?” The request is captured before it becomes a quiet source of tension.' },
    { range: [0.48, 0.72] as const, eyebrow: 'Scene 03 · The decision', title: 'Included, or extra?', body: 'Both sides see the same scope. One decision replaces a long thread of assumptions.' },
    { range: [0.72, 1] as const, eyebrow: 'Scene 04 · The handoff', title: 'Approval first. Payout after.', body: 'The money stays held until the work is approved. Clarity protects the creator and the client.' },
  ];
  return (
    <div ref={containerRef} className="relative -mx-5 h-[340vh] sm:-mx-8">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden px-5 sm:px-8">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 md:grid-cols-[0.72fr_1.28fr] md:gap-12 lg:gap-16">
          <div className="relative z-20">
            <Pill tone="gold">Kemi Ade · Content creator · Lagos</Pill>
            {stages.map((stage) => {
              const opacity = beatOpacity(progress, stage.range);
              return (
                <div key={stage.title} className="absolute left-0 top-16 w-[min(90vw,30rem)] transition-[opacity,transform] duration-300" style={{ opacity, transform: `translateY(${(1 - opacity) * 18}px)` }}>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-thread-600">{stage.eyebrow}</p>
                  <h1 className="mt-5 max-w-xl font-display text-[clamp(2.5rem,6.5vw,6.5rem)] leading-[0.9] tracking-[-0.055em] text-ink-900">{stage.title}</h1>
                  <p className="mt-7 max-w-md text-base leading-relaxed text-ink-600 sm:text-lg">{stage.body}</p>
                </div>
              );
            })}
            <div className="absolute left-0 top-[28rem] flex items-center gap-3 text-xs text-ink-500">
              <span className="h-px w-10 bg-ink-900/20" /> Scroll to follow Kemi&apos;s project
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-3 mx-auto h-[17rem] w-[min(92vw,42rem)] sm:bottom-8 sm:h-[21rem] md:relative md:inset-auto md:bottom-auto md:mx-0 md:h-[32rem] md:w-auto lg:h-[38rem]">
            <div className="absolute inset-0 rounded-[2rem] bg-thread-100/50 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-[-18%] opacity-35" aria-hidden="true">
              <HeroScene progress={progress} />
            </div>
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
              <CinematicWorkspace progress={progress} />
            </div>
            <div className="absolute bottom-3 right-2 rounded-xl bg-ink-900 px-4 py-3 text-bone-50 shadow-[var(--shadow-ledger)] sm:right-10">
              <p className="text-[10px] uppercase tracking-[0.18em] text-bone-200/60">Project status</p>
              <p className="mt-1 text-sm">{progress > 0.72 ? 'Ready to release' : progress > 0.45 ? 'Change under review' : 'Scope aligned'}</p>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center text-[10px] uppercase tracking-[0.25em] text-ink-500/70">scroll to move the story</div>
      </div>
    </div>
  );
}

function CinematicWorkspace({ progress }: { progress: number }) {
  const review = progress > 0.3;
  const resolved = progress > 0.7;
  return (
    <div className="relative rotate-[1.5deg] rounded-[1.5rem] border border-ink-900/10 bg-bone-50 p-3 shadow-[0_30px_90px_rgba(20,23,31,0.18)] sm:p-5">
      <div className="rounded-xl border border-ink-900/10 bg-bone-100/55 p-4 sm:p-6">
        <div className="flex items-center justify-between border-b border-ink-900/10 pb-4"><div><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-thread-600">Active project</p><h2 className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">Lumo Skincare</h2></div><Pill tone={resolved ? 'verified' : 'default'}>{resolved ? 'Approved' : 'In progress'}</Pill></div>
        <div className="grid gap-3 py-5 sm:grid-cols-3"><WorkspaceStat label="Project value" value={resolved ? '₦330k' : '₦300k'} /><WorkspaceStat label="Deposit" value="40%" /><WorkspaceStat label="Payment" value={resolved ? 'Released' : 'Held safely'} /></div>
        <div className={`rounded-xl border p-4 transition-colors duration-500 ${review ? 'border-gold-500/30 bg-gold-100/50' : 'border-ink-900/10 bg-bone-50/60'}`}><p className="text-xs font-medium uppercase tracking-[0.15em] text-gold-600">{review ? 'Change request' : 'Locked scope'}</p><p className="mt-2 text-sm text-ink-800">{review ? '“Can you add one more TikTok?”' : '3 TikTok videos · 2 Instagram posts'}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-900/10"><div className={`h-full rounded-full transition-all duration-700 ${resolved ? 'w-full bg-verified-600' : review ? 'w-2/3 bg-gold-500' : 'w-1/3 bg-thread-600'}`} /></div><div className="mt-2 flex justify-between text-[11px] text-ink-500"><span>Brief</span><span>Change</span><span>Approval</span><span>Paid</span></div></div>
        <p className="mt-4 text-xs text-ink-500">{resolved ? 'Both sides approved. Creator payout is now safe to release.' : 'Every decision is visible to both sides.'}</p>
      </div>
    </div>
  );
}

function EditorialHero() {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-5 sm:px-8 sm:pb-24">
      <div className="mx-auto max-w-7xl">
        <header className="relative z-20 flex items-center justify-between rounded-full border border-ink-900/10 bg-bone-50/85 px-4 py-3 shadow-[var(--shadow-ledger)] backdrop-blur-md sm:px-6">
          <Link href="/" className="font-display text-xl italic text-ink-900" aria-label="CREW home">CREW</Link>
          <nav className="hidden items-center gap-7 text-sm text-ink-600 md:flex" aria-label="Main navigation">
            <a href="#how-it-works" className="transition-colors hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900">How it works</a>
            <a href="#demo" className="transition-colors hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900">See the workspace</a>
            <a href="#voices" className="transition-colors hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900">For creators</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/demo" className="hidden px-3 py-2 text-sm font-medium text-ink-700 sm:block">Explore demo</Link>
            <Link href="/app" className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-bone-50 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">Open workspace</Link>
          </div>
        </header>

        <div className="grid items-center gap-10 pb-6 pt-16 lg:grid-cols-[0.86fr_1.14fr] lg:gap-16 lg:pt-24">
          <div className="relative z-10">
            <Pill tone="gold">For independent creators</Pill>
            <h1 className="mt-6 max-w-xl font-display text-[clamp(3.3rem,7vw,6.8rem)] leading-[0.9] tracking-[-0.055em] text-ink-900">
              Make the work.<br />
              <span className="text-thread-600">Keep the clarity.</span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-relaxed text-ink-600 sm:text-lg">
              CREW keeps your brief, changes, costs, client approval, and payment in one calm project thread — so the creative work can stay creative.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/demo" className="inline-flex items-center rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-bone-50 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
                Walk through Kemi&apos;s deal
              </Link>
              <a href="#how-it-works" className="inline-flex items-center rounded-full border border-ink-900/15 bg-bone-50 px-5 py-3 text-sm font-medium text-ink-800 hover:border-ink-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
                See how it works <span className="ml-2" aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="mt-10 flex items-center gap-3 text-xs text-ink-500">
              <span className="flex -space-x-2" aria-hidden="true">
                {['K', 'A', 'M'].map((letter) => <span key={letter} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-bone-100 bg-ink-900 text-[10px] text-bone-50">{letter}</span>)}
              </span>
              <span>Made for the person behind the deliverable.</span>
            </div>
          </div>

          <HeroWorkspace reducedMotion={reducedMotion} />
        </div>
      </div>
      <div className="pointer-events-none absolute -right-28 top-48 h-96 w-96 rounded-full bg-gold-100/70 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-thread-100/60 blur-3xl" aria-hidden="true" />
    </section>
  );
}

function HeroWorkspace({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className={`relative ${reducedMotion ? '' : 'animate-[hero-float_7s_ease-in-out_infinite]'}`}>
      <div className="absolute -left-5 top-12 z-10 hidden rounded-xl border border-ink-900/10 bg-bone-50 px-4 py-3 shadow-[var(--shadow-ledger)] sm:block">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">Client paid</p>
        <p className="num mt-1 text-lg text-verified-600">Held safely</p>
      </div>
      <div className="relative rotate-[1.5deg] rounded-[1.5rem] border border-ink-900/10 bg-bone-50 p-3 shadow-[0_30px_90px_rgba(20,23,31,0.18)] sm:p-5">
        <div className="rounded-xl border border-ink-900/10 bg-bone-100/55 p-4 sm:p-6">
          <div className="flex items-center justify-between border-b border-ink-900/10 pb-4">
            <div><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-thread-600">Active project</p><h2 className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">Lumo Skincare</h2></div>
            <Pill tone="verified">In progress</Pill>
          </div>
          <div className="grid gap-3 py-5 sm:grid-cols-3">
            <WorkspaceStat label="Project value" value="₦300k" />
            <WorkspaceStat label="Deposit" value="40%" />
            <WorkspaceStat label="Due" value="10 days" />
          </div>
          <div className="rounded-xl border border-gold-500/25 bg-gold-100/45 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.15em] text-gold-600">New request</p><p className="mt-1 text-sm text-ink-800">“Can you add one more TikTok?”</p></div><span className="rounded-full bg-bone-50 px-2 py-1 text-[10px] text-ink-600">Needs a decision</span></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-900/10"><div className="h-full w-2/3 rounded-full bg-gold-500" /></div>
            <div className="mt-2 flex justify-between text-[11px] text-ink-500"><span>Brief</span><span>Change</span><span>Approval</span><span>Paid</span></div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-ink-500"><span>Creator cash position</span><span className="num text-ink-900">₦55,000 ahead</span></div>
        </div>
      </div>
      <div className="absolute -bottom-6 -right-3 hidden rounded-xl border border-ink-900/10 bg-ink-900 px-4 py-3 text-bone-50 shadow-[var(--shadow-ledger)] sm:block">
        <p className="text-[10px] uppercase tracking-[0.18em] text-bone-200/60">Next move</p>
        <p className="mt-1 text-sm">Agree before you deliver.</p>
      </div>
    </div>
  );
}

function WorkspaceStat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-ink-500">{label}</p><p className="num mt-1 text-xl text-ink-900">{value}</p></div>;
}

function ProofStrip() {
  return (
    <section id="how-it-works" className="border-y border-ink-900/10 bg-bone-50 px-5 py-6 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 text-sm sm:grid-cols-3 sm:gap-8">
        {[
          ['01', 'Agree clearly', 'Lock the scope before the first deliverable.'],
          ['02', 'Keep the thread', 'Record every change where both sides can see it.'],
          ['03', 'Release with trust', 'Client approval comes before creator payout.'],
        ].map(([number, title, body]) => <div key={number} className="flex gap-3"><span className="num text-xs text-thread-600">{number}</span><div><p className="font-medium text-ink-900">{title}</p><p className="mt-1 text-ink-500">{body}</p></div></div>)}
      </div>
    </section>
  );
}

/** Reduced-motion / no-3D fallback: the original simple stacked-reveal version, no pinning or scene. */
function StaticOpeningScene() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.16, y: 10, duration: 0.8, ease: 'power2.out' });
  return (
    <section className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-6 py-24 sm:px-8" ref={ref}>
      <div className="space-y-3">
        {BEAT_TEXTS.slice(0, 5).map((beat) => (
          <p key={beat.text} data-reveal className="font-display text-2xl text-ink-500 sm:text-3xl">
            {beat.text}
          </p>
        ))}
      </div>
      <p data-reveal className="mt-8 font-display text-4xl leading-tight text-ink-900 sm:text-6xl">
        {BEAT_TEXTS[5].text}
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
        <CreatorProjectScene progress={progress} />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-5 pt-[12vh] text-center sm:px-8">
          {BEAT_TEXTS.map((beat) =>
            beat.big ? (
              <div
                key={beat.text}
                className="absolute left-1/2 w-[min(90vw,38rem)] -translate-x-1/2 rounded-2xl bg-bone-50/90 px-4 py-2 font-display text-[clamp(2rem,8vw,3.75rem)] leading-[1.04] text-ink-900 shadow-sm backdrop-blur text-balance"
              >
                {beat.text.split(' ').map((word, i, arr) => {
                  const wordOffset = i * 0.015;
                  const wordRange = [beat.range[0] + wordOffset, Math.min(beat.range[1], beat.range[0] + wordOffset + 0.14)] as const;
                  const op = beatOpacity(progress, wordRange, beat.holdAtEnd);
                  return (
                    <span
                      key={i}
                      className="inline-block will-change-transform"
                      style={{
                        opacity: op,
                        // Blur-and-rise on reveal reads as considered/editorial
                        // rather than a plain opacity fade — cheap (filter +
                        // transform only) and it's what the reduced-motion
                        // fallback above intentionally skips.
                        filter: `blur(${(1 - op) * 3}px)`,
                        transform: `translateY(${(1 - op) * 6}px)`,
                      }}
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
                className="absolute left-1/2 w-[min(86vw,36rem)] -translate-x-1/2 rounded-xl bg-bone-50/90 px-4 py-2 font-display text-[clamp(1.35rem,4vw,1.875rem)] leading-tight text-ink-500 shadow-sm backdrop-blur text-balance"
                style={{
                  opacity: beatOpacity(progress, beat.range, beat.holdAtEnd),
                  filter: `blur(${(1 - beatOpacity(progress, beat.range, beat.holdAtEnd)) * 2.5}px)`,
                }}
              >
                {beat.text}
              </p>
            ),
          )}
        </div>

        {/* Scroll cue: at rest (progress ≈ 0) the scene has barely revealed itself yet
            and there's no text on screen either (first beat hasn't faded in), so with
            nothing prompting the visitor to scroll the opening can read as an empty
            frame. Fades out over the first sliver of scroll. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-2 sm:bottom-12"
          style={{ opacity: Math.max(0, 1 - progress / 0.04) }}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500/70">Scroll</span>
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-8 w-5 items-start justify-center rounded-full border border-ink-900/20 p-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ink-900/40" />
          </motion.span>
        </div>
      </div>
    </section>
  );
}

function CreatorProjectScene({ progress }: { progress: number }) {
  const settled = progress > 0.76;
  const review = progress > 0.48;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden bg-bone-100/35 px-5 pt-16"
    >
      <div className="absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-gold-100/80 blur-3xl" />
      <div className="absolute bottom-[12%] right-[8%] h-56 w-56 rounded-full bg-thread-100/60 blur-3xl" />
      <div className="relative w-[min(94vw,66rem)]">
        <div className="mb-3 flex items-center justify-between px-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500/70">
          <span>Creator workspace</span>
          <span className="num">KEMI / 01</span>
        </div>
        <div className="grid overflow-hidden rounded-2xl border border-ink-900/10 bg-bone-50/90 shadow-[0_24px_80px_rgba(20,23,31,0.14)] backdrop-blur sm:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-ink-900/10 p-5 sm:border-b-0 sm:border-r sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900 font-display text-lg text-bone-50">K</div>
              <div>
                <p className="font-medium text-ink-900">Kemi Ade</p>
                <p className="text-xs text-ink-500">Content creator · Lagos</p>
              </div>
            </div>
            <p className="mt-12 max-w-xs font-display text-3xl leading-tight text-ink-900 sm:text-4xl">
              The work is creative. The project should still feel clear.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <HeroMetric label="Projects" value="17" />
              <HeroMetric label="On-time pay" value="88%" />
            </div>
          </div>
          <div className="p-5 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-thread-600">Active project</p>
                <h3 className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">Lumo Skincare deal</h3>
                <p className="mt-1 text-sm text-ink-500">Brand campaign · ₦300,000</p>
              </div>
              <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-medium text-ink-700">{settled ? 'Aligned' : 'In progress'}</span>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <HeroPanel title="Agreed scope">
                <span>3 TikTok videos</span><span>2 Instagram posts</span>
              </HeroPanel>
              <HeroPanel title={review ? 'Change request' : 'Payment milestone'} accent={review}>
                {review ? <><span>+ one more TikTok</span><span className="text-thread-600">Awaiting agreement</span></> : <><span>40% deposit</span><span className="text-verified-600">Payment held safely</span></>}
              </HeroPanel>
            </div>
            <div className="mt-7 border-t border-ink-900/10 pt-5">
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span>Project thread</span><span className="num">{settled ? '6 / 6' : review ? '3 / 6' : '2 / 6'} moments</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                {['Agreed', 'Work', 'Change', 'Deliver', 'Approve', 'Paid'].map((item, index) => {
                  const active = index < (settled ? 6 : review ? 3 : 2);
                  return <span key={item} className={`h-2 flex-1 rounded-full ${active ? 'bg-verified-600' : 'bg-ink-900/10'}`} title={item} />;
                })}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-700">
                {settled ? 'Both sides can see what changed, what was delivered, and what happens to the money next.' : 'CREW keeps the brief, change, delivery, approval, and payment in one visible thread.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-ink-900/10 bg-white/60 p-3"><p className="text-[11px] text-ink-500">{label}</p><p className="num mt-1 text-lg text-ink-900">{value}</p></div>;
}

function HeroPanel({ title, children, accent = false }: { title: string; children: ReactNode; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? 'border-gold-500/35 bg-gold-100/45' : 'border-ink-900/10 bg-white/55'}`}><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500">{title}</p><div className="space-y-1 text-sm text-ink-800">{children}</div></div>;
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
  const costs = kemiProject.costs;
  const revenue = kemiProject.revenue;

  const rows = [
    { label: 'Revenue', value: revenue, positive: true },
    ...costs.map((c) => ({ label: c.label, value: -c.amount, positive: false })),
  ];

  return (
    <section className="atelier-ink border-t border-ink-900/5 px-6 py-24 text-bone-50 sm:px-8" ref={ref}>
      <div className="mx-auto max-w-2xl">
        <p data-reveal className="mb-8 text-sm font-medium uppercase tracking-wide text-bone-200/50">
          The Lumo Skincare deal
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
          <Metric label="Locked scope" value="3 TikToks · 2 posts" accent />
          <Metric label="Client payment" value={`${kemiProject.expectedPaymentDays} days`} />
          <Metric label="One more video" value={formatNaira(kemiProject.changeRequests?.[0]?.priceImpact ?? 0)} accent />
        </div>

        <div ref={headlineRef} className="mt-14 font-display text-3xl leading-snug sm:text-4xl">
          {splitWords('The deal was profitable.')}
          <br />
          <span className="text-bone-200/60">{splitWords('The problem was knowing what "extra" meant.')}</span>
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

export function InteractiveDemo() {
  const [depositPct, setDepositPct] = useState(kemiProject.depositPct);
  const [costs, setCosts] = useState(kemiProject.costs);
  const [classification, setClassification] = useState<'included' | 'extra' | null>(null);
  const [creatorApproved, setCreatorApproved] = useState(false);
  const [clientApproved, setClientApproved] = useState(false);
  const [invoiceGenerated, setInvoiceGenerated] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  const changeRequest = kemiProject.changeRequests?.[0] ?? kemiPersona.changeRequest;
  const bothApproved = creatorApproved && clientApproved;
  const changeIsExtra = classification === 'extra';
  const changeAccepted = bothApproved && changeIsExtra;

  const baseRevenue = kemiProject.revenue;
  const revenue = changeAccepted ? baseRevenue + changeRequest.priceImpact : baseRevenue;

  const impact = calculateDepositImpact(costs, revenue, depositPct, kemiProject.expectedPaymentDays);
  const profit = calculateExpectedProfit(costs, revenue);
  const recommended = recommendMinimumSafeDeposit(costs, revenue);
  const forecast = buildCashFlowProjection(costs, revenue, depositPct, kemiProject.expectedPaymentDays, 0);
  const currentCashPosition = paymentVerified ? profit : impact.depositAmount - sumCreatorFundedCosts(costs);

  function updateCostAmount(id: string, amount: number) {
    setCosts((prev) => prev.map((c) => (c.id === id ? { ...c, amount: Math.max(0, amount) } : c)));
  }

  return (
    <section className="atelier-table border-t border-ink-900/5 px-6 py-24 sm:px-8" id="demo">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl sm:text-4xl">Follow the creator deal</h2>
          <p className="mt-2 text-sm text-ink-500">This demo uses sample business data — no account needed.</p>
        </div>

        <Card className="p-5 sm:p-7">
          {/* Step 1: the deal + locked scope */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Deal</div>
              <h3 className="font-display text-2xl">{kemiProject.name}</h3>
              <p className="text-sm text-ink-500">{kemiProject.clientName} · Content creator</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-ink-500">Total</div>
              <motion.div
                key={revenue}
                initial={{ opacity: 0.4, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`num text-xl font-medium ${changeAccepted ? 'text-verified-600' : 'text-ink-900'}`}
              >
                {formatNaira(revenue)}
              </motion.div>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-ink-900/10 bg-bone-100/40 p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Locked scope</div>
            <ul className="space-y-1.5 text-sm">
              {(kemiProject.scope ?? kemiPersona.scope).map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span className="text-ink-700">
                    {item.quantity} {item.unit}
                    {item.quantity > 1 ? 's' : ''} — {item.label}
                    {item.quantity > 1 ? 's' : ''}
                  </span>
                  <Pill>Locked</Pill>
                </li>
              ))}
              {changeAccepted && (
                <motion.li
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center justify-between"
                >
                  <span className="text-ink-700">1 extra {changeRequest.label.replace('One more ', '')}</span>
                  <Pill tone="verified">Appended</Pill>
                </motion.li>
              )}
            </ul>
          </div>

          {/* Step 2: the hero moment — the change request */}
          <div className="mb-6 rounded-xl border border-gold-500/30 bg-gold-100/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gold-500">Lumo Skincare asks</div>
                <p className="text-sm font-medium text-ink-900">"Can you add one more TikTok video?"</p>
              </div>
              {changeAccepted && <Pill tone="verified">Agreed</Pill>}
            </div>

            {!changeAccepted && (
              <>
                <p className="mb-3 text-sm text-ink-700">Was that included in the original scope — or extra?</p>
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClassification('included')}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      classification === 'included' ? 'border-ink-900 bg-ink-900 text-bone-50' : 'border-ink-900/15 bg-white/60 text-ink-700'
                    }`}
                  >
                    Included — no charge
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassification('extra')}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      classification === 'extra' ? 'border-thread-600 bg-thread-600 text-bone-50' : 'border-ink-900/15 bg-white/60 text-ink-700'
                    }`}
                  >
                    Extra — {formatNaira(changeRequest.priceImpact)}
                  </button>
                </div>

                {classification === 'included' && (
                  <p className="text-sm text-ink-500">Marked as already covered by the original scope — no price change, no approval needed.</p>
                )}

                {changeIsExtra && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatorApproved((v) => !v)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        creatorApproved ? 'border-verified-600 bg-verified-100 text-verified-600' : 'border-ink-900/15 bg-white/60 text-ink-700'
                      }`}
                    >
                      {creatorApproved && <Check className="mr-1 inline size-3.5" aria-hidden="true" />}
                      You approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientApproved((v) => !v)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        clientApproved ? 'border-verified-600 bg-verified-100 text-verified-600' : 'border-ink-900/15 bg-white/60 text-ink-700'
                      }`}
                    >
                      {clientApproved && <Check className="mr-1 inline size-3.5" aria-hidden="true" />}
                      Lumo approves
                    </button>
                  </div>
                )}
              </>
            )}

            {changeAccepted && (
              <p className="text-sm text-verified-600">
                Both sides agreed — total updated to {formatNaira(revenue)}. Your deposit already covers it; no new invoice needed.
              </p>
            )}
          </div>

          {/* Step 3: costs — secondary, still editable */}
          <details className="mb-6 rounded-xl border border-ink-900/10 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-700">Costs & cash position</summary>
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
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

            <div className="mb-2 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultStat label="Upfront exposure" value={formatNaira(impact.upfrontExposure)} tone={impact.upfrontExposure > 0 ? 'thread' : 'default'} />
              <ResultStat label="Cash gap" value={formatNaira(impact.cashGap)} tone={impact.cashGap > 0 ? 'thread' : 'default'} />
              <ResultStat label="Expected profit" value={formatNaira(profit)} tone="verified" />
              <ResultStat label="Days to cash" value={`${kemiProject.expectedPaymentDays}`} />
            </div>

            <div className="mb-2 rounded-xl border border-ink-900/10 p-3">
              <DepositSlider value={depositPct} onChange={setDepositPct} recommended={recommended} />
            </div>

            {impact.cashGap === 0 ? (
              <p className="text-sm text-verified-600">No gap — your deposit already covers your creator-funded costs.</p>
            ) : (
              <p className="text-sm text-thread-600">Recommended deposit: {recommended}% to close the gap.</p>
            )}

            <div className="mt-4 grid grid-cols-5 gap-1.5">
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
          </details>

          {/* Step 4: client link preview */}
          <div className="mb-6 border-t border-ink-900/10 pt-6">
            {!invoiceGenerated ? (
              <Button onClick={() => setInvoiceGenerated(true)}>Preview client link</Button>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-ink-900/10 bg-bone-100/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Client link preview</span>
                    <Pill>No signup needed</Pill>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <Row label="Client" value={kemiProject.clientName} />
                    <Row label="Amount" value={formatNaira(revenue)} />
                    <Row label="Deposit" value={`${depositPct}% · ${formatNaira(impact.depositAmount)}`} />
                    <Row label="Balance" value={formatNaira(revenue - impact.depositAmount)} />
                    <Row label="Due" value={`${kemiProject.expectedPaymentDays} days after delivery`} />
                  </div>
                </div>
                <div className="rounded-xl border border-verified-600/20 bg-verified-100/40 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-verified-600">WhatsApp-ready</p>
                  <p className="text-sm text-ink-700">
                    "Hi {kemiProject.clientName}, here's your link for the {kemiProject.name.toLowerCase()} — {formatNaira(revenue)} total, {formatNaira(impact.depositAmount)} deposit to start. CREW link: crew.app/pay/{kemiProject.id}"
                  </p>
                </div>

                {/* Step 5: simulated payment */}
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
                      Cash position: {formatNaira(currentCashPosition)}. Expected profit: {formatNaira(profit)}. Deal status: paid.
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

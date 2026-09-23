'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * A slim progress line pinned to the very top of the viewport, tracking
 * scroll through the whole page. Updates the DOM directly via a ref
 * (transform: scaleX) instead of React state, so it doesn't cause a
 * re-render on every scroll tick.
 */
export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const trigger = ScrollTrigger.create({
      start: 0,
      end: () => document.documentElement.scrollHeight - window.innerHeight,
      onUpdate: (self) => {
        if (barRef.current) barRef.current.style.transform = `scaleX(${self.progress})`;
      },
    });

    return () => trigger.kill();
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[2px] bg-transparent" aria-hidden>
      <div ref={barRef} className="h-full origin-left bg-thread-600" style={{ transform: 'scaleX(0)' }} />
    </div>
  );
}

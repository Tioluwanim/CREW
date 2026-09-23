'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);
gsap.registerPlugin(useGSAP);

interface RevealOptions {
  /** Seconds between each [data-reveal] element inside the container. */
  stagger?: number;
  /** y-offset each element animates in from, in px. */
  y?: number;
  /** x-offset each element animates in from, in px. */
  x?: number;
  /** ScrollTrigger start position for the container. */
  start?: string;
  /** Duration and easing for this section's reveal character. */
  duration?: number;
  ease?: string;
}

/**
 * Scopes a GSAP + ScrollTrigger fade/rise-in animation to every
 * `[data-reveal]` element inside the returned container ref. This is the
 * cinematic scroll-storytelling layer for the landing page narrative
 * (opening lines, the cost reveal, section headings) — product UI
 * transitions elsewhere in the app use Framer Motion instead, per the
 * brief's animation-system split.
 */
export function useGsapReveal<T extends HTMLElement>(options: RevealOptions = {}) {
  const { stagger = 0.08, y = 20, x = 0, start = 'top 85%', duration = 0.65, ease = 'power3.out' } = options;
  const containerRef = useRef<T | null>(null);

  useGSAP(
    () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]', containerRef.current);
      if (targets.length === 0) return;

      if (prefersReduced) {
        gsap.set(targets, { opacity: 1, x: 0, y: 0 });
        return;
      }

      gsap.set(targets, { opacity: 0, x, y });
      targets.forEach((el, i) => {
        gsap.to(el, {
          opacity: 1,
          x: 0,
          y: 0,
          duration,
          ease,
          delay: stagger * i,
          scrollTrigger: {
            trigger: el,
            start,
            toggleActions: 'play none none none',
          },
        });
      });
    },
    { scope: containerRef, dependencies: [stagger, x, y, start, duration, ease], revertOnUpdate: true },
  );

  return containerRef;
}

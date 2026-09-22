import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface RevealOptions {
  /** Seconds between each [data-reveal] element inside the container. */
  stagger?: number;
  /** y-offset each element animates in from, in px. */
  y?: number;
  /** ScrollTrigger start position for the container. */
  start?: string;
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
  const { stagger = 0.08, y = 20, start = 'top 85%' } = options;
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]', container);
      if (targets.length === 0) return;

      if (prefersReduced) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }

      gsap.set(targets, { opacity: 0, y });
      targets.forEach((el, i) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: 'power3.out',
          delay: stagger * i,
          scrollTrigger: {
            trigger: el,
            start,
            toggleActions: 'play none none none',
          },
        });
      });
    }, container);

    return () => ctx.revert();
  }, [stagger, y, start]);

  return containerRef;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Tracks scroll progress (0-1) through the returned container's height,
 * pinned against the viewport. This is the single driver for the opening
 * scene's beat text (already GSAP-based) AND the 3D scene below — both
 * read the same progress value, so they can never drift out of lockstep
 * the way two independent timers/drivers could.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const trigger = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => setProgress(self.progress),
    });

    return () => trigger.kill();
  }, []);

  return { containerRef, progress };
}

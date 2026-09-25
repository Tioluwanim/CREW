'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

/**
 * Floating pill navbar for the landing page. Sits inset from the top edge
 * rather than spanning full-width, so it reads as an object hovering over
 * the page rather than a fixed toolbar. Tightens slightly on scroll so it
 * still feels anchored once the hero has moved past it.
 */
export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:pt-5">
      <motion.header
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        className={cn(
          'pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border backdrop-blur-md',
          scrolled
            ? 'border-ink-900/10 bg-bone-50/85 px-4 py-2 shadow-[0_8px_30px_-12px_rgba(20,23,31,0.35)]'
            : 'border-white/10 bg-bone-50/60 px-5 py-2.5 shadow-[0_4px_20px_-10px_rgba(20,23,31,0.25)]',
        )}
      >
        <Link href="/" className="flex items-center gap-1.5 pl-1">
          <span className="font-display text-lg italic leading-none text-ink-900">CREW</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/demo"
            className="hidden rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-900/5 hover:text-ink-900 sm:inline-block"
          >
            Explore the demo
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-1.5 text-sm font-medium text-bone-50 transition-colors hover:bg-ink-800"
          >
            Open workspace
          </Link>
        </nav>
      </motion.header>
    </div>
  );
}

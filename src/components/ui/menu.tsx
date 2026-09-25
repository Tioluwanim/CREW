'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

export function MenuPanel({
  className,
  align = 'end',
  children,
  ...props
}: { align?: 'start' | 'end'; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={cn(
        'absolute top-[calc(100%+0.5rem)] z-50 w-[min(90vw,20rem)] origin-top rounded-2xl border border-ink-900/10 bg-white/95 p-1.5 shadow-[var(--shadow-ledger)] backdrop-blur-md',
        align === 'end' ? 'right-0' : 'left-0',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

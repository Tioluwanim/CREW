import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-900/10 bg-white/70 shadow-[var(--shadow-ledger)] backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  );
}

export function StatLabel({ children }: { children: ReactNode }) {
  return <div className="text-[13px] text-ink-500">{children}</div>;
}

export function StatValue({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'thread' | 'verified' }) {
  const toneClass =
    tone === 'thread' ? 'text-thread-600' : tone === 'verified' ? 'text-verified-600' : 'text-ink-900';
  return <div className={cn('num text-2xl font-medium', toneClass)}>{children}</div>;
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:opacity-40 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-ink-900 text-bone-50 hover:bg-ink-800',
    secondary: 'bg-white border border-ink-900/15 text-ink-900 hover:border-ink-900/30',
    ghost: 'text-ink-700 hover:bg-ink-900/5',
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'thread' | 'verified' | 'gold' }) {
  const tones = {
    default: 'bg-ink-900/5 text-ink-700',
    thread: 'bg-thread-100 text-thread-600',
    verified: 'bg-verified-100 text-verified-600',
    gold: 'bg-gold-100 text-gold-500',
  };
  return <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', tones[tone])}>{children}</span>;
}

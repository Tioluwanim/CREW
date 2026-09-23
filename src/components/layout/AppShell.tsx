'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Briefcase, Users, Receipt, Wallet, TrendingUp, Plus, UserCircle, Sparkles, Settings } from 'lucide-react';
import { FloatingCopilot } from '../copilot/FloatingCopilot';
import { CopilotProvider } from '../copilot/CopilotContext';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/projects', label: 'Projects', icon: Briefcase, end: false },
  { to: '/app/cash-flow', label: 'Cash', icon: Wallet, end: false },
  { to: '/app/invoices', label: 'Invoices', icon: Receipt, end: false },
];

const desktopExtraItems = [
  { to: '/app/clients', label: 'Clients', icon: Users, end: false },
  { to: '/app/profit', label: 'Profit', icon: TrendingUp, end: false },
];

const desktopSecondaryItems = [
  { to: '/app/profile', label: 'Business profile', icon: UserCircle, end: false },
  { to: '/app/opportunities', label: 'Opportunities', icon: Sparkles, end: false },
  { to: '/app/settings', label: 'Settings', icon: Settings, end: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const linkClass = (to: string, end = false) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-900/5',
      (end ? pathname === to : pathname.startsWith(to)) && 'bg-ink-900 text-bone-50 hover:bg-ink-900',
    );
  const secondaryLinkClass = (to: string) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-500 transition-colors hover:bg-ink-900/5 hover:text-ink-700',
      pathname.startsWith(to) && 'bg-ink-900/5 text-ink-900',
    );
  return (
    <CopilotProvider>
      <div className="min-h-screen bg-bone-50">
        {/* Desktop sidebar */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-ink-900/10 lg:bg-bone-100/60">
          <div className="px-6 py-7">
            <span className="font-display text-xl italic text-ink-900">CREW</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            {[...navItems, ...desktopExtraItems].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={linkClass(item.to, item.end)}
              >
                <item.icon size={17} strokeWidth={2} />
                {item.label}
              </Link>
            ))}
          </nav>
          <nav className="flex flex-col gap-1 border-t border-ink-900/10 px-3 py-3">
            {desktopSecondaryItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={secondaryLinkClass(item.to)}
              >
                <item.icon size={16} strokeWidth={2} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-ink-900/10 p-4">
            <Link href="/app/projects/new" className="flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2.5 text-sm font-medium text-bone-50">
              <Plus size={16} /> New project
            </Link>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-60">
          {/* Mobile top bar: wordmark + settings access, since bottom nav stays to the core 4 items */}
          <div className="flex items-center justify-between border-b border-ink-900/10 bg-bone-50/90 px-4 py-3 backdrop-blur lg:hidden">
            <span className="font-display text-lg italic text-ink-900">CREW</span>
            <Link href="/app/settings" aria-label="Settings" className="rounded-full p-1.5 text-ink-500 hover:bg-ink-900/5 hover:text-ink-900">
              <Settings size={19} strokeWidth={2} />
            </Link>
          </div>
          <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >{children}</motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-900/10 bg-bone-50/95 px-2 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-500', (item.end ? pathname === item.to : pathname.startsWith(item.to)) && 'text-ink-900')}
            >
              <item.icon size={20} strokeWidth={2} />
              {item.label}
            </Link>
          ))}
        </nav>

        <FloatingCopilot />
      </div>
    </CopilotProvider>
  );
}

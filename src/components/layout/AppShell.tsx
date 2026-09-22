import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Users, Receipt, Wallet, TrendingUp, Plus } from 'lucide-react';
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

export function AppShell() {
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
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-900/5',
                    isActive && 'bg-ink-900 text-bone-50 hover:bg-ink-900',
                  )
                }
              >
                <item.icon size={17} strokeWidth={2} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-ink-900/10 p-4">
            <NavLink to="/app/projects" className="flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2.5 text-sm font-medium text-bone-50">
              <Plus size={16} /> New project
            </NavLink>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-60">
          <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-ink-900/10 bg-bone-50/95 px-2 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-ink-500', isActive && 'text-ink-900')
              }
            >
              <item.icon size={20} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <FloatingCopilot />
      </div>
    </CopilotProvider>
  );
}

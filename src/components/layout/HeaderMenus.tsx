'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { Bell, Check, CircleDollarSign, FileClock, TrendingDown, FolderPlus, MessageCircleQuestion, UserCircle, Settings, LogOut } from 'lucide-react';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';
import { MenuPanel } from '../ui/menu';
import { kemiProfile } from '../../data/demoData';
import { demoNotifications as initialNotifications } from '../../data/notifications';
import type { AppNotification, NotificationKind } from '../../types';
import { cn } from '../../lib/cn';

const kindIcon: Record<NotificationKind, typeof Bell> = {
  payment_verified: CircleDollarSign,
  invoice_viewed: FileClock,
  cash_gap: TrendingDown,
  project_created: FolderPlus,
  change_request: MessageCircleQuestion,
};

const kindTone: Record<NotificationKind, string> = {
  payment_verified: 'text-verified-600 bg-verified-100',
  invoice_viewed: 'text-ink-700 bg-ink-900/5',
  cash_gap: 'text-thread-600 bg-thread-100',
  project_created: 'text-ink-700 bg-ink-900/5',
  change_request: 'text-gold-500 bg-gold-100',
};

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissableMenu(open, close);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const menuId = useId();

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={menuId}
        className="relative rounded-full p-2 text-ink-500 transition-colors hover:bg-ink-900/5 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
      >
        <Bell size={19} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-thread-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <MenuPanel id={menuId} role="dialog" aria-label="Notifications" align="end" className="max-h-[min(70vh,24rem)] overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-ink-900/10 px-4 py-3">
              <span className="text-sm font-medium text-ink-900">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded px-1 text-xs font-medium text-ink-500 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
                >
                  <Check size={13} /> Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-500">You're all caught up.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {notifications.map((notification) => {
                  const Icon = kindIcon[notification.kind];
                  const body = (
                    <div className={cn('flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-900/5', !notification.read && 'bg-gold-100/30')}>
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', kindTone[notification.kind])}>
                        <Icon size={15} strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                          {notification.title}
                          {!notification.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden />}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-500">{notification.description}</p>
                        <p className="mt-1 text-[11px] text-ink-500/70">
                          {formatDistanceToNowStrict(new Date(notification.occurredAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={notification.id}>
                      {notification.href ? (
                        <Link href={notification.href} onClick={() => { markRead(notification.id); close(); }} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ink-900">
                          {body}
                        </Link>
                      ) : (
                        <button type="button" onClick={() => { markRead(notification.id); close(); }} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ink-900">
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </MenuPanel>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissableMenu(open, close);
  const initial = kemiProfile.ownerName.charAt(0).toUpperCase();
  const menuId = useId();

  const links = [
    { href: '/app/profile', label: 'Business profile', icon: UserCircle },
    { href: '/app/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={menuId}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-bone-50 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
      >
        {initial}
      </button>

      <AnimatePresence>
        {open && (
          <MenuPanel id={menuId} role="dialog" aria-label="Account actions" align="end">
            <div className="border-b border-ink-900/10 px-3 py-2.5">
              <p className="text-sm font-medium text-ink-900">{kemiProfile.businessName}</p>
              <p className="text-[12px] text-ink-500">{kemiProfile.craft}</p>
            </div>
            <div className="py-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-700 hover:bg-ink-900/5 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ink-900"
                >
                  <link.icon size={16} strokeWidth={2} />
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="border-t border-ink-900/10 py-1">
              <Link
                href="/"
                onClick={close}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-thread-600 hover:bg-thread-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-thread-600"
              >
                <LogOut size={16} strokeWidth={2} />
                Sign out
              </Link>
            </div>
          </MenuPanel>
        )}
      </AnimatePresence>
    </div>
  );
}

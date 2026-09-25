import type { AppNotification } from '../types';

// Sample data for the demo workspace, in the same spirit as demoData.ts —
// grounded in real product events (a payment verified via webhook, an
// invoice viewed, a forecasted cash gap) rather than generic placeholder
// copy. Timestamps are relative to "now" at load time so they always read
// as recent regardless of when the demo is run.
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const demoNotifications: AppNotification[] = [
  {
    id: 'notif-payment-verified',
    kind: 'payment_verified',
    title: 'Deposit verified',
    description: "Teni's ₦268,800 deposit on the Aso-ebi order is confirmed and verified.",
    occurredAt: hoursAgo(2),
    read: false,
    href: '/app/projects/project-asoebi',
  },
  {
    id: 'notif-cash-gap',
    kind: 'cash_gap',
    title: 'Cash gap forecasted',
    description: 'Your projected balance may dip before the balance payment lands. Review the forecast.',
    occurredAt: hoursAgo(6),
    read: false,
    href: '/app/cash-flow',
  },
  {
    id: 'notif-invoice-viewed',
    kind: 'invoice_viewed',
    title: 'Invoice opened',
    description: 'Teni opened the balance invoice for the Aso-ebi order.',
    occurredAt: hoursAgo(27),
    read: true,
    href: '/app/invoices',
  },
];

import type { AppNotification } from '../types';

// Sample data for the demo workspace, in the same spirit as demoData.ts —
// grounded in real product events (a payment verified via webhook, a
// change request needing classification) rather than generic placeholder
// copy. Timestamps are relative to "now" at load time so they always read
// as recent regardless of when the demo is run.
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const demoNotifications: AppNotification[] = [
  {
    id: 'notif-change-request',
    kind: 'change_request',
    title: 'Lumo Skincare asked for one more video',
    description: 'Was "one more TikTok" included in the original scope, or extra? Classify it in the Changes tab.',
    occurredAt: hoursAgo(2),
    read: false,
    href: '/app/projects/project-lumo-deal',
  },
  {
    id: 'notif-payment-verified',
    kind: 'payment_verified',
    title: 'Deposit verified',
    description: "Lumo Skincare's ₦120,000 deposit on the Lumo Skincare deal is confirmed and verified.",
    occurredAt: hoursAgo(6),
    read: false,
    href: '/app/projects/project-lumo-deal',
  },
  {
    id: 'notif-invoice-viewed',
    kind: 'invoice_viewed',
    title: 'Client link opened',
    description: 'Lumo Skincare opened the client link for the Lumo Skincare deal.',
    occurredAt: hoursAgo(27),
    read: true,
    href: '/app/invoices',
  },
];

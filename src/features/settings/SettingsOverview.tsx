'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, Pill } from '../../components/ui/primitives';
import { EcobankBadge } from '../../components/ui/EcobankBadge';
import { amaraProfile } from '../../data/demoData';

const sections = [
  { label: 'Profile', desc: `${amaraProfile.ownerName} · ${amaraProfile.businessName}` },
  { label: 'Business profile', desc: 'Craft, location, typical deposit', href: '/app/profile' },
  { label: 'Opportunities', desc: 'Financing, insurance — not connected', href: '/app/opportunities' },
  { label: 'Notifications', desc: 'Payment and invoice alerts' },
  { label: 'Privacy & consent', desc: 'What CREW can use and share', href: '/app/consent' },
  { label: 'Connected payment providers', desc: 'Sandbox — Ecobank integration' },
  { label: 'Workspace settings', desc: 'Currency, timezone' },
  { label: 'Billing', desc: 'Free plan' },
];

export function SettingsOverview() {
  const [deleted, setDeleted] = useState(false);
  return <div><header className="mb-6"><h1 className="font-display text-3xl text-ink-900">Settings</h1></header><Card className="divide-y divide-ink-900/10 p-1">{sections.map((section) => { const content = <div className="flex items-center justify-between gap-4 p-4"><div><div className="text-sm font-medium text-ink-900">{section.label}</div><div className="mt-0.5 text-xs text-ink-500">{section.desc}</div></div>{section.href && <ChevronRight size={16} className="text-ink-300" />}</div>; return section.href ? <Link key={section.label} href={section.href} className="block hover:bg-ink-900/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">{content}</Link> : <div key={section.label}>{content}</div>; })}</Card><div className="mt-6 flex items-center gap-2"><EcobankBadge /><Pill>No live bank connection in this build</Pill></div>{deleted ? <p className="mt-8 text-sm text-ink-500">Account deletion is unavailable in the demo.</p> : <button type="button" onClick={() => setDeleted(true)} className="mt-8 rounded-md px-2 py-1 text-sm font-medium text-thread-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-thread-600">Delete account</button>}</div>;
}
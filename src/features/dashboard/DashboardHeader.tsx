'use client';

import { useDashboardGreeting } from './useDashboardModel';

export function DashboardHeader() {
  const { ownerName, businessName } = useDashboardGreeting();

  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl text-ink-900">Good morning, {ownerName}</h1>
      <p className="mt-1 text-sm text-ink-500">Here's where {businessName} stands today.</p>
    </header>
  );
}
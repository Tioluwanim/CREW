'use client';

import { AppShell } from '../../src/components/layout/AppShell';

export const dynamic = 'force-dynamic';

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
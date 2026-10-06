'use client';

import { AppShell } from '../../src/components/layout/AppShell';
import { WorkspaceGate } from '../../src/components/layout/WorkspaceGate';

export const dynamic = 'force-dynamic';

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceGate>
      <AppShell>{children}</AppShell>
    </WorkspaceGate>
  );
}
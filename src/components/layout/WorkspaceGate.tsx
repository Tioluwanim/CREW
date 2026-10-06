'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccess } from '../../lib/session';
import { loadLiveWorkspace } from '../../services/workspace';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { ErrorState } from '../ui/states';

function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bone-50">
      <p className="text-sm text-ink-500" role="status">
        {label}
      </p>
    </div>
  );
}

/**
 * Guards the product (/app/*):
 *   mock / demo   built-in demo data, nothing to load
 *   anon          sent to /signin (and back to the page they asked for afterwards)
 *   authed        loads their own profile, projects and clients, then shows the app
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const access = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detail, setDetail] = useState<string>();

  const load = useCallback(() => {
    setState('loading');
    loadLiveWorkspace()
      .then(() => setState('ready'))
      .catch((error: unknown) => {
        setDetail(error instanceof Error ? error.message : undefined);
        setState('error');
      });
  }, []);

  // Redirect signed-out visitors (also re-checked when they navigate between /app pages).
  useEffect(() => {
    if (access === 'anon') router.replace(`/signin?next=${encodeURIComponent(pathname || '/app')}`);
  }, [access, pathname, router]);

  // Load / unload the data once per sign-in state, not on every page change.
  useEffect(() => {
    if (access === 'authed') {
      load();
      return;
    }
    setState('idle');
    // Leaving live data (signed out, or entering the demo): show the built-in demo data again.
    if (useWorkspaceStore.getState().source === 'live') useWorkspaceStore.getState().resetToDemo();
  }, [access, load]);

  if (access === 'loading' || access === 'anon') return <Splash label={access === 'anon' ? 'Taking you to sign in…' : 'Loading…'} />;
  if (access === 'authed') {
    if (state === 'error') {
      return (
        <div className="mx-auto max-w-md px-6 py-24">
          <ErrorState message="CREW couldn't load your workspace." detail={detail} onRetry={load} />
        </div>
      );
    }
    if (state !== 'ready') return <Splash label="Loading your workspace…" />;
  }
  return <>{children}</>;
}

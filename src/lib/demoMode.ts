import { useSyncExternalStore } from 'react';
import { USE_MOCK_API } from './apiConfig';

// "Explore demo" must always run on the built-in demo data, even when the app is
// pointed at a live backend. The /demo route starts a demo session (a flag in
// sessionStorage, so it ends with the tab); while it is on, no feature talks to
// the backend. Signing in ends the demo session (see authToken.setAccessToken).

const DEMO_KEY = 'crew.demoSession';

export function enterDemoSession(): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(DEMO_KEY, '1');
  } catch {
    // Storage blocked: the demo still works in mock mode, and in live mode falls back to live data.
  }
}

export function exitDemoSession(): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(DEMO_KEY);
  } catch {
    // nothing to clear
  }
}

export function isDemoSession(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

/** True when features should use the backend: live mode is on and this is not a demo session. */
export function isLiveBackend(): boolean {
  return !USE_MOCK_API && !isDemoSession();
}

/** Render-safe version of isLiveBackend: false on the server and first paint, then the real value. */
export function useLiveBackend(): boolean {
  return useSyncExternalStore(
    () => () => {},
    isLiveBackend,
    () => false,
  );
}

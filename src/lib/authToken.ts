import { exitDemoSession } from './demoMode';

// Access-token storage for the live backend. Browser storage can be blocked or
// absent (private windows, SSR, tests), so every access is guarded and the app
// must keep working with no stored token.

const TOKEN_KEY = 'crew.accessToken';

export function getAccessToken(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  exitDemoSession(); // signing in leaves the demo
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable: the token lives only for this page load's requests via the caller.
  }
}

export function clearAccessToken(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing to clear
  }
}

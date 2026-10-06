import { useSyncExternalStore } from 'react';
import { USE_MOCK_API } from './apiConfig';
import { getAccessToken } from './authToken';
import { isDemoSession } from './demoMode';
import { subscribeSession } from './sessionEvents';

/**
 * Who is using the app right now:
 *   mock    built-in demo data, no backend configured (the repo's default)
 *   demo    "Explore the demo" session: built-in demo data even though a backend is configured
 *   anon    backend configured, nobody signed in -> must sign in
 *   authed  backend configured and a token is stored
 *   loading first paint / server render: storage is not readable yet
 */
export type AccessState = 'mock' | 'demo' | 'anon' | 'authed' | 'loading';

export function resolveAccess(input: { useMock: boolean; demo: boolean; token: string | null }): Exclude<AccessState, 'loading'> {
  if (input.useMock) return 'mock';
  if (input.demo) return 'demo';
  return input.token ? 'authed' : 'anon';
}

function readAccess(): AccessState {
  return resolveAccess({ useMock: USE_MOCK_API, demo: isDemoSession(), token: getAccessToken() });
}

export function useAccess(): AccessState {
  return useSyncExternalStore(subscribeSession, readAccess, () => 'loading');
}

/** Only follow `?next=` to a page inside the app, never to another site. */
export function safeNextPath(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || !raw.startsWith('/app') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  return raw;
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAccess, safeNextPath } from './session';

describe('resolveAccess', () => {
  it('mock mode never needs an account', () => {
    expect(resolveAccess({ useMock: true, demo: false, token: null })).toBe('mock');
  });
  it('a demo session wins over a stored token, so Explore the demo always shows demo data', () => {
    expect(resolveAccess({ useMock: false, demo: true, token: 'abc' })).toBe('demo');
  });
  it('with a backend: no token means sign in, a token means signed in', () => {
    expect(resolveAccess({ useMock: false, demo: false, token: null })).toBe('anon');
    expect(resolveAccess({ useMock: false, demo: false, token: 'abc' })).toBe('authed');
  });
});

describe('safeNextPath', () => {
  it('only follows paths inside the app', () => {
    expect(safeNextPath('/app/projects')).toBe('/app/projects');
    expect(safeNextPath('https://evil.example')).toBe('/app');
    expect(safeNextPath('//evil.example/app')).toBe('/app');
    expect(safeNextPath('/app\\..\\evil')).toBe('/app');
    expect(safeNextPath('/signin')).toBe('/app');
    expect(safeNextPath(null)).toBe('/app');
  });
});

describe('session changes are announced', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('signing in and out notify subscribers, and signing in ends a demo session', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'false');
    const { subscribeSession } = await import('./sessionEvents');
    const { setAccessToken, clearAccessToken } = await import('./authToken');
    const { enterDemoSession, isDemoSession } = await import('./demoMode');
    const listener = vi.fn();
    const off = subscribeSession(listener);
    enterDemoSession();
    expect(isDemoSession()).toBe(true);
    setAccessToken('t');
    expect(isDemoSession()).toBe(false);
    clearAccessToken();
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
    off();
    listener.mockClear();
    setAccessToken('t2');
    expect(listener).not.toHaveBeenCalled();
  });
});

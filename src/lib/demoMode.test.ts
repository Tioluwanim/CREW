import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('demo session', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is not live in mock mode (the default)', async () => {
    const { isLiveBackend } = await import('./demoMode');
    expect(isLiveBackend()).toBe(false);
  });

  it('is live in live mode, until a demo session starts', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'false');
    const { isLiveBackend, enterDemoSession, isDemoSession } = await import('./demoMode');
    expect(isLiveBackend()).toBe(true);
    enterDemoSession();
    expect(isDemoSession()).toBe(true);
    expect(isLiveBackend()).toBe(false);
  });

  it('signing in ends the demo session', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'false');
    const { enterDemoSession, isLiveBackend } = await import('./demoMode');
    const { setAccessToken } = await import('./authToken');
    enterDemoSession();
    setAccessToken('token');
    expect(isLiveBackend()).toBe(true);
  });
});

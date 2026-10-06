import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function mockFlag(env: Record<string, string>) {
  for (const k of ['NEXT_PUBLIC_USE_MOCK_API', 'NEXT_PUBLIC_API_BASE_URL']) vi.stubEnv(k, env[k] ?? '');
  vi.resetModules();
  return (await import('./apiConfig')).USE_MOCK_API;
}

describe('USE_MOCK_API', () => {
  it('is the demo when nothing is configured', async () => expect(await mockFlag({})).toBe(true));
  it('goes live when only a backend URL is set', async () => expect(await mockFlag({ NEXT_PUBLIC_API_BASE_URL: 'https://api.example.com/api' })).toBe(false));
  it('an explicit true keeps the demo even with a URL', async () => expect(await mockFlag({ NEXT_PUBLIC_USE_MOCK_API: 'true', NEXT_PUBLIC_API_BASE_URL: 'https://x/api' })).toBe(true));
  it('an explicit false goes live', async () => expect(await mockFlag({ NEXT_PUBLIC_USE_MOCK_API: 'false' })).toBe(false));
});

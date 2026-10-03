import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiJson, ApiError } from './apiClient';
import { clearAccessToken, getAccessToken, setAccessToken } from './authToken';
import { createProject } from '../services/projects';

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: url as string, init: init as RequestInit, headers: new Headers((init as RequestInit).headers) };
}

describe('apiClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    clearAccessToken();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends no Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await apiFetch('/projects');
    expect(lastCall(fetchMock).headers.has('Authorization')).toBe(false);
  });

  it('sends the stored token as a Bearer header', async () => {
    setAccessToken('abc');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await apiFetch('/projects');
    expect(lastCall(fetchMock).headers.get('Authorization')).toBe('Bearer abc');
  });

  it('clears a token the backend rejects with 401', async () => {
    setAccessToken('stale');
    fetchMock.mockResolvedValue(new Response('{"error":"nope"}', { status: 401 }));
    await apiFetch('/projects');
    expect(getAccessToken()).toBeNull();
  });

  it('apiJson surfaces the backend { error } message', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"name: field required"}', { status: 422 }));
    const failure = apiJson('/projects', { method: 'POST', body: {} });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toThrow('name: field required');
  });

  it('createProject posts JSON with an Idempotency-Key and the backend field names', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":"p1"}', { status: 201 }));
    await createProject(
      { name: 'Shoot', clientName: 'Zainab', revenue: 100_000, depositPct: 40, costs: [{ label: 'Materials', amount: 20_000 }] },
      'key-1',
    );
    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe('/api/projects');
    expect(init.method).toBe('POST');
    expect(headers.get('Idempotency-Key')).toBe('key-1');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Shoot',
      clientName: 'Zainab',
      revenue: 100_000,
      depositPct: 40,
      costs: [{ category: 'other', label: 'Materials', amount: 20_000 }],
    });
  });
});

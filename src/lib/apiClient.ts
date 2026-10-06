import { API_BASE_URL, USE_MOCK_API } from './apiConfig';
import { clearAccessToken, getAccessToken } from './authToken';
import { demoLogin } from '../services/auth';

// The one place that talks to the backend. Services call apiFetch(path) and keep
// their own `if (!res.ok) throw ...` handling, so error messages and the
// mock-to-real swap contract (see apiConfig.ts) are unchanged.
//
// - Adds `Authorization: Bearer <token>` when a token is stored.
// - With NEXT_PUBLIC_DEMO_AUTO_LOGIN=true (dev only, needs backend CREW_DEMO_MODE=true),
//   fetches a demo token on first use so the app works with no login screen yet.
// - Sends an Idempotency-Key header when `idempotencyKey` is given (the backend
//   replays the first response for the same key and request).
// - A 401 on a request that carried a token clears it, so a stale token does not
//   keep failing.

const AUTO_DEMO_LOGIN = process.env.NEXT_PUBLIC_DEMO_AUTO_LOGIN === 'true';

let demoLoginInFlight: Promise<string | null> | null = null;

async function ensureToken(): Promise<string | null> {
  const existing = getAccessToken();
  if (existing) return existing;
  if (USE_MOCK_API || !AUTO_DEMO_LOGIN) return null;
  demoLoginInFlight ??= demoLogin()
    .catch(() => null)
    .finally(() => {
      demoLoginInFlight = null;
    });
  return demoLoginInFlight;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiRequestInit = Omit<RequestInit, 'body'> & {
  /** Plain objects are sent as JSON. */
  body?: unknown;
  idempotencyKey?: string;
};

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function apiFetch(path: string, init: ApiRequestInit = {}): Promise<Response> {
  const { body, idempotencyKey, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);

  const token = await ensureToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof body === 'string' || body instanceof FormData || body instanceof Blob) {
      payload = body;
    } else {
      headers.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers, body: payload });
  if (res.status === 401 && token) clearAccessToken();
  return res;
}

/** For callers that want the backend's `{ "error": string }` message surfaced. */
export async function apiJson<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep the generic message
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

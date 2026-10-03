import { API_BASE_URL as BASE } from '../lib/apiConfig';
import { clearAccessToken, setAccessToken } from '../lib/authToken';

// Auth talks to the backend directly with fetch (not apiFetch) because apiFetch
// itself calls demoLogin() when auto demo login is on; going through it here
// would loop.

interface TokenResponse {
  accessToken: string;
  tokenType?: string;
}

async function requestToken(path: string, body?: unknown): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = 'Sign-in failed';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  const data = (await res.json()) as TokenResponse;
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export function login(email: string, password: string): Promise<string> {
  return requestToken('/auth/login', { email, password });
}

/** Only works while the backend runs with CREW_DEMO_MODE=true and the demo data is seeded. */
export function demoLogin(): Promise<string> {
  return requestToken('/auth/demo');
}

export function logout(): void {
  clearAccessToken();
}

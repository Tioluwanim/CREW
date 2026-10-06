import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useParams: () => paramsRef.current }));
const paramsRef = { current: {} as Record<string, string> };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); sessionStorage.clear(); });

async function renderLive(params: Record<string, string>) {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'false');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'This link is no longer valid' }), { status: 404 })));
  vi.resetModules();
  paramsRef.current = params;
  const { ClientProjectClientPage } = await import('../../app/pay/client-pages');
  render(<ClientProjectClientPage />);
}

describe('client link page', () => {
  it('a demo project id shows the demo page even in a fresh tab on a live build', async () => {
    await renderLive({ id: 'project-lumo-deal' });
    expect(await screen.findByText(/Sent to you by/i, undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText('This link is no longer valid')).toBeNull();
  });

  it('a real token goes to the backend share page', async () => {
    await renderLive({ id: 'k3j2h4g5f6d7s8a9' });
    expect(await screen.findByText('This link is no longer valid', undefined, { timeout: 5000 })).toBeTruthy();
  });
});

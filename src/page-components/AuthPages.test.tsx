import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => '/signin' }));

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'false');
  return import('./AuthPages');
}

describe('auth pages (backend configured)', () => {
  beforeEach(() => {
    replace.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules(); // don't leave modules evaluated with the backend env for later test files
  });

  it('sign-in stores the token and goes to the page the visitor asked for', async () => {
    const fetchMock = respond(200, { accessToken: 'tok', tokenType: 'bearer' });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/signin?next=/app/cash-flow');
    const { SignInPage } = await load();
    render(<SignInPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'amara@crew.demo');
    await userEvent.type(screen.getByLabelText('Password'), 'crew-demo-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app/cash-flow'));
    expect(window.localStorage.getItem('crew.accessToken')).toBe('tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(JSON.parse(init.body)).toEqual({ email: 'amara@crew.demo', password: 'crew-demo-1234' });
  });

  it('sign-in shows the backend error and stores nothing', async () => {
    vi.stubGlobal('fetch', respond(401, { error: 'Invalid credentials' }));
    window.history.pushState({}, '', '/signin');
    const { SignInPage } = await load();
    render(<SignInPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(window.localStorage.getItem('crew.accessToken')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sign-up registers the account, then continues to onboarding', async () => {
    const fetchMock = respond(201, { accessToken: 'new-tok' });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/signup');
    const { SignUpPage } = await load();
    render(<SignUpPage />);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Your name'), 'Amara Obi');
    await userEvent.type(screen.getByLabelText('Business or studio name'), 'Amara Studio');
    await userEvent.type(screen.getByLabelText('Email'), 'amara@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'short');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^Password/), 'er-and-longer');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/register');
    expect(JSON.parse(init.body)).toEqual({ email: 'amara@example.com', password: 'shorter-and-longer', ownerName: 'Amara Obi', businessName: 'Amara Studio' });
    expect(window.localStorage.getItem('crew.accessToken')).toBe('new-tok');
  });
});

describe('auth pages (no backend)', () => {
  it('say no account is needed and point at the demo', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'true');
    const { SignInPage } = await import('./AuthPages');
    render(<SignInPage />);
    expect(screen.getByText('No account needed here')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore the demo' })).toHaveAttribute('href', '/demo');
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

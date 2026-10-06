import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => '/onboarding' }));

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'false');
  return import('./OnboardingPage');
}

async function answerEverything(cash: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Fashion' }));
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await userEvent.selectOptions(screen.getByLabelText('How long have you been doing this?'), '1–3 years');
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await userEvent.click(screen.getByRole('button', { name: 'Per project' }));
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await userEvent.click(screen.getByRole('button', { name: '50%' }));
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await userEvent.type(screen.getByPlaceholderText('0'), cash);
}

describe('onboarding with a backend', () => {
  beforeEach(() => {
    replace.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    vi.resetModules(); // don't leave modules evaluated with the backend env for later test files
  });

  it('sends a signed-out visitor to sign up first', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { OnboardingPage } = await load();
    render(<OnboardingPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/signup'));
  });

  it('saves the answers to the profile before showing the finish screen', async () => {
    window.localStorage.setItem('crew.accessToken', 'tok');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { OnboardingPage } = await load();
    render(<OnboardingPage />);
    await answerEverything('150000');
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Your workspace is ready.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/profile');
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ craft: 'Fashion', typicalDepositPct: 50, startingCash: 150000 });
  });

  it('stays on the last step and shows the error if saving fails', async () => {
    window.localStorage.setItem('crew.accessToken', 'tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"nope"}', { status: 500 })));
    const { OnboardingPage } = await load();
    render(<OnboardingPage />);
    await answerEverything('1000');
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
    expect(screen.queryByText('Your workspace is ready.')).not.toBeInTheDocument();
  });
});

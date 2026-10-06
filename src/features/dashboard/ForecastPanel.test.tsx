import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); sessionStorage.clear(); });

const flow = [{ label: 'Today', date: '2026-10-06', projectedBalance: 0, inflow: 0, outflow: 0 }];

describe('ForecastPanel', () => {
  it('draws no band caption in mock/demo mode', async () => {
    const { ForecastPanel } = await import('./ForecastPanel');
    render(<ForecastPanel cashFlow={flow} gapDate={null} />);
    expect(screen.queryByText(/Shaded range/)).toBeNull();
  });

  it('explains the band, and that the delay is an estimate, in live mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK_API', 'false');
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      model: 'learned-payment-timing', learned: false, horizonDays: 30, bandMethod: 'timing-scenarios',
      delay: { expectedDays: 6, pessimisticDays: 11, source: 'craft_prior' },
      points: [{ label: 'Today', date: '2026-10-06', projectedBalance: 1000, low: 500, high: 1500 }, { label: '+7 days', date: '2026-10-13', projectedBalance: 2000, low: 900, high: 3000 }],
    }))));
    const { ForecastPanel } = await import('./ForecastPanel');
    render(<ForecastPanel cashFlow={flow} gapDate={null} />);
    await waitFor(() => expect(screen.getByText(/Shaded range/)).toBeTruthy());
    expect(screen.getByText(/starting estimate/)).toBeTruthy();
  });
});

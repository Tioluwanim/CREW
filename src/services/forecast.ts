import type { components } from '../api/generated';
import { apiFetch } from '../lib/apiClient';
type ForecastResponse = components['schemas']['ForecastResponse'];

export async function getForecast(): Promise<ForecastResponse> {
  const res = await apiFetch(`/forecast`);
  if (!res.ok) throw new Error('Failed to load forecast');
  return res.json();
}

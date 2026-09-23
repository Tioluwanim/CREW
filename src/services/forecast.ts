import type { components } from '../api/generated';
import { API_BASE_URL as BASE } from '../lib/apiConfig';
type ForecastResponse = components['schemas']['ForecastResponse'];

export async function getForecast(): Promise<ForecastResponse> {
  const res = await fetch(`${BASE}/forecast`);
  if (!res.ok) throw new Error('Failed to load forecast');
  return res.json();
}

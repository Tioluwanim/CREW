import type { CashFlowPoint } from '../types';
import { API_BASE_URL as BASE } from '../lib/apiConfig';
export async function getForecast(): Promise<{ points: CashFlowPoint[] }> {
  const res = await fetch(`${BASE}/forecast`);
  if (!res.ok) throw new Error('Failed to load forecast');
  return res.json();
}

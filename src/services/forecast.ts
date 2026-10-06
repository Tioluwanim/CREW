import type { components } from '../api/generated';
import { apiFetch } from '../lib/apiClient';
type ForecastResponse = components['schemas']['ForecastResponse'];

export async function getForecast(): Promise<ForecastResponse> {
  const res = await apiFetch(`/forecast`);
  if (!res.ok) throw new Error('Failed to load forecast');
  return res.json();
}

export interface ForecastBandPoint {
  label: string;
  date: string;
  projectedBalance: number;
  /** Present only when the backend produced a timing band (learned forecaster). */
  low?: number;
  high?: number;
}

export interface ForecastSeries {
  model: string;
  /** True only when a trained model produced the payment delay behind the band. */
  learned: boolean;
  horizonDays: number;
  points: ForecastBandPoint[];
  bandMethod?: string;
  delay?: { days?: number; source?: string; optimisticDays?: number; expectedDays?: number; pessimisticDays?: number };
}

/** Live mode only: the creator's portfolio forecast with payment-timing bands (GET /forecast/series). */
export async function getForecastSeries(horizonDays = 30): Promise<ForecastSeries> {
  const res = await apiFetch(`/forecast/series?horizon_days=${horizonDays}`);
  if (!res.ok) throw new Error('Failed to load forecast');
  return res.json();
}

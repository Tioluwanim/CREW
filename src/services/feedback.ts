import type { Feedback } from '../types';
import { API_BASE_URL as BASE } from '../lib/apiConfig';
export async function getFeedback(): Promise<Feedback[]> {
  const res = await fetch(`${BASE}/feedback`);
  if (!res.ok) throw new Error('Failed to load feedback');
  return res.json();
}

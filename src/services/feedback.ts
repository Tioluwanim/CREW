import type { components } from '../api/generated';
import { apiFetch } from '../lib/apiClient';
type Feedback = components['schemas']['Feedback'];

export async function getFeedback(): Promise<Feedback[]> {
  const res = await apiFetch(`/feedback`);
  if (!res.ok) throw new Error('Failed to load feedback');
  return res.json();
}

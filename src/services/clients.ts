import type { components } from '../api/generated';
import { apiFetch } from '../lib/apiClient';
type Client = components['schemas']['Client'];

export async function getClients(): Promise<Client[]> {
  const res = await apiFetch(`/clients`);
  if (!res.ok) throw new Error('Failed to load clients');
  return res.json();
}

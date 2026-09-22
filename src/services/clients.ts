import type { Client } from '../types';
import { API_BASE_URL as BASE } from '../lib/apiConfig';
export async function getClients(): Promise<Client[]> {
  const res = await fetch(`${BASE}/clients`);
  if (!res.ok) throw new Error('Failed to load clients');
  return res.json();
}

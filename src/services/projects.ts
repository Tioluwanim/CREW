import type { Project } from '../types';

// Thin service boundary. Today this talks to the MSW mock handlers under
// /api/*; swapping to a real FastAPI backend later should only require
// changing the base URL / fetch implementation here, not the UI.

import { API_BASE_URL as BASE } from '../lib/apiConfig';

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/projects`);
  if (!res.ok) throw new Error('Failed to load projects');
  return res.json();
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${BASE}/projects/${id}`);
  if (!res.ok) throw new Error('Failed to load project');
  return res.json();
}

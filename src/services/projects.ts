import type { components } from '../api/generated';

type Project = components['schemas']['Project'];

// Thin service boundary. Today this talks to the MSW mock handlers under
// /api/*; swapping to a real FastAPI backend later should only require
// changing the base URL / fetch implementation here, not the UI.

import { apiFetch, apiJson, newIdempotencyKey } from '../lib/apiClient';
import type { Project as AppProject } from '../types';
import { adaptProject } from './adapt';

export async function getProjects(): Promise<AppProject[]> {
  const res = await apiFetch(`/projects`);
  if (!res.ok) throw new Error('Failed to load projects');
  return ((await res.json()) as unknown[]).map(adaptProject);
}

export async function getProject(id: string): Promise<AppProject> {
  const res = await apiFetch(`/projects/${id}`);
  if (!res.ok) throw new Error('Failed to load project');
  return adaptProject(await res.json());
}

export interface CreateProjectInput {
  name: string;
  clientName: string;
  /** Whole naira, matching the backend's ProjectIn. */
  revenue: number;
  depositPct: number;
  expectedPaymentDays?: number;
  craft?: string;
  costs: { label: string; category?: string; amount: number }[];
}

/**
 * Creates a project on the live backend. Pass the same `idempotencyKey` when
 * retrying the same submission so a double-click or network retry cannot create
 * the project twice (the backend replays the first response).
 */
export async function createProject(input: CreateProjectInput, idempotencyKey: string = newIdempotencyKey()): Promise<Project> {
  return apiJson<Project>('/projects', {
    method: 'POST',
    idempotencyKey,
    body: {
      ...input,
      costs: input.costs.map((c) => ({ category: 'other', ...c })),
    },
  });
}

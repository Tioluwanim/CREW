import { apiFetch } from '../lib/apiClient';
import { getProjects } from './projects';

export type BackendProjectWorkspace = {
  project: Record<string, unknown>;
  financials: Record<string, unknown>;
  intelligence: Record<string, unknown>;
  forecast: Record<string, unknown>;
  simulation: Record<string, unknown>;
  depositAnalysis: Record<string, unknown>;
  costBuffer: Record<string, unknown>;
  timeline: Record<string, unknown>;
  reconciliation: Record<string, unknown>;
  copilotContext: Record<string, unknown>;
  dlStatus: Record<string, unknown>;
};

async function getJson(path: string): Promise<Record<string, unknown>> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path} (${response.status})`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function getProjectWorkspace(projectId: string): Promise<BackendProjectWorkspace> {
  const encodedId = encodeURIComponent(projectId);
  const [
    project,
    financials,
    intelligence,
    forecast,
    simulation,
    depositAnalysis,
    costBuffer,
    timeline,
    reconciliation,
    copilotContext,
    dlStatus,
  ] = await Promise.all([
    getJson(`/projects/${encodedId}`),
    getJson(`/projects/${encodedId}/financials`),
    getJson(`/projects/${encodedId}/intelligence`),
    getJson(`/projects/${encodedId}/forecast`),
    getJson(`/projects/${encodedId}/simulation`),
    getJson(`/projects/${encodedId}/deposit-analysis`),
    getJson(`/projects/${encodedId}/cost-buffer`),
    getJson(`/projects/${encodedId}/timeline`),
    getJson(`/projects/${encodedId}/reconciliation`),
    getJson(`/projects/${encodedId}/copilot-context`),
    getJson('/dl/model-status'),
  ]);

  return {
    project,
    financials,
    intelligence,
    forecast,
    simulation,
    depositAnalysis,
    costBuffer,
    timeline,
    reconciliation,
    copilotContext,
    dlStatus,
  };
}

const resolvedIds = new Map<string, string>();

/**
 * The frontend's demo project ("project-lumo-deal") and the backend's seeded
 * one have different ids. Resolve the backend id: an exact id match first, then
 * the same project name. Returns null when the backend has no such project, so
 * callers can fall back to local data instead of requesting a 404.
 */
export async function resolveBackendProjectId(project: { id: string; name: string }): Promise<string | null> {
  const cached = resolvedIds.get(project.id);
  if (cached) return cached;
  const projects = await getProjects();
  const match = projects.find((p) => p.id === project.id) ?? projects.find((p) => p.name === project.name);
  if (match) resolvedIds.set(project.id, match.id);
  return match?.id ?? null;
}

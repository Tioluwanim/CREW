import { API_BASE_URL as BASE } from '../lib/apiConfig';

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
  const response = await fetch(`${BASE}${path}`);
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

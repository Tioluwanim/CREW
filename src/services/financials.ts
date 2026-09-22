import type { ProjectFinancialSnapshot } from '../types';
import { API_BASE_URL as BASE } from '../lib/apiConfig';

/**
 * Fetches the full computed financial snapshot for a project. The shape
 * returned here (ProjectFinancialSnapshot, see types/index.ts) is exactly
 * what a real FastAPI endpoint doing the same computation server-side
 * would return — swapping USE_MOCK_API off points this at that endpoint
 * with no change to any call site.
 */
export async function getProjectFinancials(projectId: string): Promise<ProjectFinancialSnapshot> {
  const res = await fetch(`${BASE}/projects/${projectId}/financials`);
  if (!res.ok) throw new Error('Failed to load project financials');
  return res.json();
}

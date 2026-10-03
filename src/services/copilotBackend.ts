import type { CopilotAction } from '../types';
import { apiJson } from '../lib/apiClient';

const ACTION_KINDS: ReadonlySet<string> = new Set(['simulate_deposit', 'view_forecast', 'review_invoice', 'view_history', 'show_gap']);

export interface BackendCopilotAnswer {
  text: string;
  actions?: CopilotAction[];
  agent?: string;
}

interface RawAnswer {
  text?: unknown;
  actions?: unknown;
  agent?: unknown;
}

/**
 * Asks the backend copilot (POST /copilot/chat). Its answer is built from the
 * engine's numbers for the given backend project id. Actions are kept only if
 * the UI knows how to handle their kind.
 */
export async function askBackendCopilot(message: string, backendProjectId: string | null): Promise<BackendCopilotAnswer> {
  const raw = await apiJson<RawAnswer>('/copilot/chat', {
    method: 'POST',
    body: { message, projectId: backendProjectId },
  });
  const actions = Array.isArray(raw.actions)
    ? (raw.actions as Partial<CopilotAction>[]).filter(
        (a): a is CopilotAction => typeof a?.id === 'string' && typeof a?.label === 'string' && typeof a?.kind === 'string' && ACTION_KINDS.has(a.kind),
      )
    : undefined;
  return {
    text: typeof raw.text === 'string' ? raw.text : '',
    actions: actions?.length ? actions : undefined,
    agent: typeof raw.agent === 'string' ? raw.agent : undefined,
  };
}

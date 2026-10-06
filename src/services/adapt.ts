import type { ChangeRequest, Milestone, MilestoneStatus, Project, ScopeItem } from '../types';

// The backend's project JSON (backend/app/services/serializers.py) and the app's `Project`
// type differ in a few places: change requests use `title`/`proposed|declined`, milestones use
// `title`, and the scope is a list of deliverables. This maps one onto the other so the
// screens keep a single shape. It is tolerant of the mock API's already-mapped shape, so it is
// safe to run in both modes.

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);

const MILESTONE_STATES: MilestoneStatus[] = ['agreed', 'funded', 'in_progress', 'in_review', 'approved', 'released'];

function adaptChange(projectId: string, raw: Raw): ChangeRequest {
  // Already in the app's shape (mock API).
  if ('label' in raw && 'priceImpact' in raw) return raw as unknown as ChangeRequest;
  const amount = num(raw.amount);
  const backendStatus = str(raw.status, 'proposed');
  const status: ChangeRequest['status'] = backendStatus === 'accepted' ? 'accepted' : backendStatus === 'declined' ? 'rejected' : 'pending';
  return {
    id: str(raw.id),
    projectId,
    label: str(raw.title) || str(raw.label),
    // Proposing a priced change is the creator's "this is extra"; a free accepted one was simply included.
    classification: amount > 0 ? 'extra' : status === 'accepted' ? 'included' : null,
    priceImpact: amount,
    status,
    // The creator proposes it; the client's side is the share-link accept.
    creatorApproved: str(raw.requestedBy, 'creator') === 'creator' || status === 'accepted',
    clientApproved: status === 'accepted',
    createdAt: str(raw.createdAt, new Date(0).toISOString()),
  };
}

function adaptMilestone(projectId: string, raw: Raw): Milestone {
  if ('label' in raw && 'projectId' in raw) return raw as unknown as Milestone;
  const status = str(raw.status, 'agreed') as MilestoneStatus;
  return {
    id: str(raw.id),
    projectId,
    label: str(raw.title) || str(raw.label),
    amount: num(raw.amount),
    status: MILESTONE_STATES.includes(status) ? status : 'agreed',
  };
}

function adaptScope(raw: Raw): ScopeItem[] | undefined {
  if (Array.isArray(raw.scope)) return raw.scope as ScopeItem[];
  if (!Array.isArray(raw.deliverables) || raw.deliverables.length === 0) return undefined;
  return (raw.deliverables as Raw[]).map((d) => ({
    id: str(d.id),
    label: str(d.title),
    quantity: 1,
    unit: 'deliverable',
    status: 'locked' as const,
  }));
}

/** Maps one project from the backend (or the mock API) onto the app's `Project`. */
export function adaptProject(input: unknown): Project {
  const raw = input as Raw;
  const id = str(raw.id);
  return {
    ...(raw as unknown as Project),
    scope: adaptScope(raw),
    changeRequests: Array.isArray(raw.changeRequests) ? (raw.changeRequests as Raw[]).map((c) => adaptChange(id, c)) : undefined,
    milestones: Array.isArray(raw.milestones) ? (raw.milestones as Raw[]).map((m) => adaptMilestone(id, m)) : undefined,
  };
}

// Core domain types for CREW.
// Kept deliberately close to what the calculation and service layers
// actually operate on — no UI concerns here.

export interface CreativeProfile {
  id: string;
  businessName: string;
  craft: string;
  location: string;
  ownerName: string;
  projectsCompleted: number;
  averageProjectValue: number;
  typicalDepositPct: number;
  averagePaymentDelayDays: number;
  averageMaterialOverrunPct: number;
  averageMarginPct: number;
  /** Share (0-1) of completed projects where the final balance arrived by
   * the expected-payment-days window. Backend-computed, display-only —
   * see features/badges. */
  onTimePaymentRate: number;
  /** Count of distinct clients with more than one completed project. */
  repeatClientCount: number;
}

export type CostFunder = 'creator' | 'client';

export interface ProjectCost {
  id: string;
  label: string;
  category: 'materials' | 'labour' | 'transport' | 'other';
  amount: number;
  /**
   * Who actually funds this cost. A client-funded cost (e.g. the client
   * buys materials directly) must NOT count against the creator's upfront
   * exposure — only creator-funded costs can put the creator's own cash
   * at risk. Defaults to 'creator' at the call sites below since that's
   * true of every cost in the current demo dataset.
   */
  fundedBy: CostFunder;
  /** Day offset from project start this cost is actually paid out. Defaults to 0 (paid immediately). */
  paidOnDay: number;
}

export type ProjectStatus = 'active' | 'awaiting_payment' | 'completed';

/** One deliverable line in a project's agreed scope (e.g. "3 TikTok videos"). */
export interface ScopeItem {
  id: string;
  label: string;
  quantity: number;
  unit: string; // "video", "post", "outfit" — whatever the craft's own unit is
  /** 'locked' = part of the original agreement; 'appended' = added later via an accepted ChangeRequest. */
  status: 'locked' | 'appended';
}

export type ChangeRequestStatus = 'pending' | 'accepted' | 'rejected';
/** Whether an ask was already covered by the original scope, or is genuinely additional work. */
export type ChangeClassification = 'included' | 'extra';

/**
 * A client ask that falls outside (or possibly outside) the locked scope.
 * The classification + price impact are proposed data, not computed by a
 * component — same "math/decision lives in one place" rule as lib/finance.ts.
 * Both sides must independently approve before it's reflected in scope/price.
 */
export interface ChangeRequest {
  id: string;
  projectId: string;
  label: string;
  /** null = not yet classified — the open "was that included, or extra?" question. */
  classification: ChangeClassification | null;
  priceImpact: number; // naira, positive = adds to project price
  status: ChangeRequestStatus;
  creatorApproved: boolean;
  clientApproved: boolean;
  createdAt: string;
}

/**
 * Lifecycle of a single payment milestone. Distinct from the simpler
 * top-level PaymentStatus (pending/unverified/verified/failed) below,
 * which describes one payment event; this describes where a whole
 * milestone sits in the "money received but not yet released" flow.
 * "funded"/"released" are neutral bookkeeping-state language, not a claim
 * of real fund custody/escrow — see project workspace Payments tab notes.
 */
export type MilestoneStatus = 'agreed' | 'funded' | 'in_progress' | 'in_review' | 'approved' | 'released';

export interface Milestone {
  id: string;
  projectId: string;
  label: string;
  amount: number;
  status: MilestoneStatus;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  craft: string;
  revenue: number;
  depositPct: number;
  costs: ProjectCost[];
  expectedPaymentDays: number;
  status: ProjectStatus;
  createdAt: string;
  activity: ActivityEvent[];
  /** Locked original scope + anything appended via an accepted change request. Optional — older demo projects don't model it yet. */
  scope?: ScopeItem[];
  changeRequests?: ChangeRequest[];
  milestones?: Milestone[];
  /** Backend lifecycle stage (brief → agreed → funded → in_progress → in_review → approved → released → closed). Absent in demo data. */
  stage?: string;
  /** Backend deliverables (live accounts). `scope` is derived from these for display. */
  deliverables?: Deliverable[];
}

export interface Deliverable {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'delivered' | 'approved' | 'revision_requested' | string;
  evidenceUrl?: string | null;
  revisions?: number;
}

export interface ActivityEvent {
  id: string;
  label: string;
  timestamp: string;
}

export interface Client {
  id: string;
  name: string;
  projectIds: string[];
  totalBilled: number;
  totalPaid: number;
  averagePaymentDays: number;
}

export type InvoiceStatus = 'draft' | 'pending_approval' | 'sent';

export interface Invoice {
  id: string;
  projectId: string;
  clientName: string;
  amount: number;
  depositPct: number;
  depositAmount: number;
  balance: number;
  dueDate: string;
  status: InvoiceStatus;
  paymentLink: string;
}

export type PaymentStatus = 'pending' | 'unverified' | 'verified' | 'failed';

export interface Payment {
  id: string;
  invoiceId: string;
  projectId: string;
  amount: number;
  status: PaymentStatus;
  method: 'manual' | 'link';
  createdAt: string;
  verifiedAt?: string;
}

export interface CashFlowPoint {
  label: string; // "Today", "+3 days", ...
  date: string;
  projectedBalance: number;
  inflow: number;
  outflow: number;
}

export interface Forecast {
  currentCash: number;
  expectedInflows: number;
  expectedExpenses: number;
  projectedGap: number;
  gapDate: string | null;
  points: CashFlowPoint[];
}

export interface GenomeMetric {
  label: string;
  value: string;
  description: string;
}

export type CopilotInsightKind = 'gap' | 'timing' | 'deposit' | 'invoice' | 'general';

export interface CopilotInsight {
  id: string;
  kind: CopilotInsightKind;
  headline: string;
  detail: string;
  actions: CopilotAction[];
  // The raw figure the calculation layer produced, so the UI/Copilot
  // never restates a number it didn't receive.
  value?: number;
}

export interface CopilotAction {
  id: string;
  label: string;
  kind: 'simulate_deposit' | 'view_forecast' | 'review_invoice' | 'view_history' | 'show_gap';
}

/**
 * Agent-tool proposals: Copilot drafts something concrete and STOPS —
 * nothing is applied to the project until the person explicitly accepts
 * it (see CopilotPanel's proposal rendering and CopilotContext's
 * resolveProposal). Same "propose, human confirms" boundary as the rest
 * of Copilot; these three are just richer than a plain navigation action.
 */
export interface CopilotScopeProposal {
  kind: 'scope';
  items: { id: string; label: string; quantity: number; unit: string }[];
}

export interface CopilotClassificationProposal {
  kind: 'classification';
  changeRequestId: string;
  classification: ChangeClassification;
  reason: string;
}

export interface CopilotNudgeProposal {
  kind: 'nudge';
  message: string;
}

export type CopilotProposal = CopilotScopeProposal | CopilotClassificationProposal | CopilotNudgeProposal;

export interface CopilotMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  actions?: CopilotAction[];
  proposal?: CopilotProposal;
  /** Undefined when there's no proposal on this message. 'pending' until
   * the person accepts or dismisses it — never auto-resolves. */
  proposalStatus?: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
}

export interface Consent {
  projectActivity: boolean;
  paymentActivity: boolean;
  businessPatterns: boolean;
  sharingLevel: 'never' | 'ask_each_time' | 'specific_partners';
}

// ---------------------------------------------------------------------------
// Backend-shaped contract types (see 45b/43b).
//
// These name and shape the eventual FastAPI DTOs. Every function in
// lib/finance.ts and services/ should be swappable for a real API call
// without changing these shapes at the call site — only the
// implementation behind services/ changes.
// ---------------------------------------------------------------------------

export interface ProjectFinancialInput {
  price: number; // naira
  costs: ProjectCost[];
  depositPct: number;
  expectedPaymentDays: number;
  currentCash: number;
}

export interface ProjectFinancialSnapshot {
  depositAmount: number;
  upfrontExposure: number;
  cashGap: number;
  expectedProfit: number;
  profitMarginPct: number;
  daysToCash: DaysToCashResult;
  cashFlow: CashFlowPoint[];
  gapDate: string | null;
}

export type DaysToCashResult =
  | { status: 'planned'; days: number }
  | { status: 'pending'; daysSoFar: number }
  | { status: 'complete'; days: number };

export interface Feedback {
  id: string;
  name: string;
  craft: string;
  location: string;
  quote: string;
  avatar: string;
  verified: boolean;
  source: string;
  date: string;
}

export type NotificationKind = 'payment_verified' | 'invoice_viewed' | 'cash_gap' | 'project_created' | 'change_request';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  /** ISO timestamp; rendered as relative time ("2h ago") in the UI. */
  occurredAt: string;
  read: boolean;
  href?: string;
}

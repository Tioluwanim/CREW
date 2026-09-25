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

export interface CopilotMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  actions?: CopilotAction[];
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

export type NotificationKind = 'payment_verified' | 'invoice_viewed' | 'cash_gap' | 'project_created';

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

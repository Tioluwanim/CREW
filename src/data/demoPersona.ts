import type { ChangeRequest, ProjectCost, ScopeItem } from '../types';

// ---------------------------------------------------------------------------
// CANONICAL DEMO DATA — SINGLE SOURCE OF TRUTH
//
// Every part of this build — the landing page, the interactive demo, the
// /app dashboard seed state, onboarding — imports Kemi's numbers from here.
// Nothing hardcodes them a second time.
//
// The canonical persona is a content-creator brand deal. One canonical
// persona lives here so the landing page, demo workspace, and API fixtures
// cannot drift into different project stories.
//
// This file holds RAW INPUTS ONLY: price, scope, costs (with who actually
// funds each one and when it's paid), deposit %, expected payment window,
// and the one change request that drives the hero interaction. Every
// derived number (upfront exposure, expected profit, days to cash, cash
// gap) is computed by lib/finance.ts — never hardcoded alongside these.
//
// DRAFT FIGURES — not researched real-world rates. Flag for the team to
// sanity-check before this goes out as a real demo.
// ---------------------------------------------------------------------------

export const kemiScope: ScopeItem[] = [
  { id: 'scope-tiktok', label: 'TikTok video', quantity: 3, unit: 'video', status: 'locked' },
  { id: 'scope-ig', label: 'Instagram post', quantity: 2, unit: 'post', status: 'locked' },
];

export const kemiCosts: ProjectCost[] = [
  { id: 'cost-editor', label: 'Video editor fee', category: 'labour', amount: 40_000, fundedBy: 'creator', paidOnDay: 0 },
  { id: 'cost-promo', label: 'Ad-boost / promotion spend', category: 'other', amount: 15_000, fundedBy: 'creator', paidOnDay: 3 },
  { id: 'cost-props', label: 'Props & wardrobe', category: 'materials', amount: 10_000, fundedBy: 'creator', paidOnDay: 0 },
];

/**
 * The hero-moment change request: the brand asks for "one more TikTok"
 * mid-project. Starts 'pending' — the interactive demo's centerpiece is
 * walking through classifying it (extra, not included) and both sides
 * approving it, which is what moves the total from ₦300,000 to ₦330,000.
 */
export const kemiChangeRequest: ChangeRequest = {
  id: 'cr-extra-tiktok',
  projectId: 'project-lumo-deal',
  label: 'One more TikTok video',
  classification: null,
  priceImpact: 30_000,
  status: 'pending',
  creatorApproved: false,
  clientApproved: false,
  createdAt: new Date().toISOString(),
};

export const kemiPersona = {
  projectName: 'Lumo Skincare deal',
  clientName: 'Lumo Skincare',
  craft: 'Content Creator',
  price: 300_000,
  scope: kemiScope,
  costs: kemiCosts,
  depositPct: 40,
  expectedPaymentDays: 10,
  changeRequest: kemiChangeRequest,
} as const;

import type { Client, CreativeProfile, Feedback, Project } from '../types';
import { asoEbiPersona } from './demoPersona';

// Every part of this build reads Amara's raw numbers from demoPersona.ts
// (section 1b) — this file builds the derived envelope objects (Project,
// Client, etc.) around those same raw inputs, so there is exactly one
// place the numbers themselves are defined.

export const amaraProfile: CreativeProfile = {
  id: 'profile-amara',
  businessName: 'Amara Studio',
  craft: 'Fashion Designer',
  location: 'Lagos, Nigeria',
  ownerName: 'Amara',
  projectsCompleted: 24,
  averageProjectValue: 280_000,
  typicalDepositPct: 56,
  averagePaymentDelayDays: 14,
  averageMaterialOverrunPct: 8,
  averageMarginPct: 32,
};

export const teniClient: Client = {
  id: 'client-teni',
  name: 'Teni',
  projectIds: ['project-asoebi'],
  totalBilled: 1_200_000,
  totalPaid: 960_000,
  averagePaymentDays: 16,
};

export const bisiClient: Client = {
  id: 'client-bisi',
  name: 'Bisi',
  projectIds: ['project-bridal-shoot'],
  totalBilled: 340_000,
  totalPaid: 340_000,
  averagePaymentDays: 9,
};

export const dapoClient: Client = {
  id: 'client-dapo',
  name: "Dapo's Wedding",
  projectIds: ['project-event-decor'],
  totalBilled: 620_000,
  totalPaid: 248_000,
  averagePaymentDays: 21,
};

export const funkeClient: Client = {
  id: 'client-funke',
  name: 'Funke',
  projectIds: ['project-ankara-set'],
  totalBilled: 210_000,
  totalPaid: 84_000,
  averagePaymentDays: 12,
};

export const clients: Client[] = [teniClient, bisiClient, dapoClient, funkeClient];

export const asoEbiProject: Project = {
  id: 'project-asoebi',
  name: asoEbiPersona.projectName,
  clientId: 'client-teni',
  clientName: asoEbiPersona.clientName,
  craft: asoEbiPersona.craft,
  revenue: asoEbiPersona.price,
  depositPct: asoEbiPersona.depositPct,
  costs: asoEbiPersona.costs,
  expectedPaymentDays: asoEbiPersona.expectedPaymentDays,
  status: 'active',
  createdAt: new Date().toISOString(),
  activity: [
    { id: 'a1', label: 'Project created', timestamp: new Date().toISOString() },
    { id: 'a2', label: 'Budget added', timestamp: new Date().toISOString() },
  ],
};

// Additional demo projects — view-only (not wired into the editable
// store, unlike asoEbiProject) so /app/projects and /app/clients read as
// a populated workspace rather than a single hero project. Their figures
// are still computed at render time from lib/finance.ts, never hardcoded
// alongside these raw inputs (same rule as demoPersona.ts).
export const otherProjects: Project[] = [
  {
    id: 'project-bridal-shoot',
    name: 'Bridal shoot — Bisi',
    clientId: 'client-bisi',
    clientName: 'Bisi',
    craft: 'Photographer',
    revenue: 340_000,
    depositPct: 60,
    costs: [
      { id: 'bs-c1', label: 'Studio rental', category: 'other', amount: 60_000, fundedBy: 'creator', paidOnDay: 0 },
      { id: 'bs-c2', label: 'Second shooter', category: 'labour', amount: 45_000, fundedBy: 'creator', paidOnDay: 0 },
      { id: 'bs-c3', label: 'Editing & retouching', category: 'labour', amount: 25_000, fundedBy: 'creator', paidOnDay: 3 },
    ],
    expectedPaymentDays: 9,
    status: 'completed',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    activity: [
      { id: 'bs-a1', label: 'Project created', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString() },
      { id: 'bs-a2', label: 'Payment verified', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString() },
    ],
  },
  {
    id: 'project-event-decor',
    name: "Dapo's wedding decor",
    clientId: 'client-dapo',
    clientName: "Dapo's Wedding",
    craft: 'Event Planner',
    revenue: 620_000,
    depositPct: 40,
    costs: [
      { id: 'ed-c1', label: 'Florals', category: 'materials', amount: 180_000, fundedBy: 'creator', paidOnDay: 2 },
      { id: 'ed-c2', label: 'Rentals (chairs, drapes)', category: 'materials', amount: 140_000, fundedBy: 'creator', paidOnDay: 5 },
      { id: 'ed-c3', label: 'Setup crew', category: 'labour', amount: 70_000, fundedBy: 'creator', paidOnDay: 20 },
      { id: 'ed-c4', label: 'Transport & logistics', category: 'transport', amount: 30_000, fundedBy: 'creator', paidOnDay: 20 },
    ],
    expectedPaymentDays: 21,
    status: 'awaiting_payment',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    activity: [
      { id: 'ed-a1', label: 'Project created', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString() },
      { id: 'ed-a2', label: 'Deposit received', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString() },
    ],
  },
  {
    id: 'project-ankara-set',
    name: 'Ankara two-piece — Funke',
    clientId: 'client-funke',
    clientName: 'Funke',
    craft: 'Fashion Designer',
    revenue: 210_000,
    depositPct: 40,
    costs: [
      { id: 'as-c1', label: 'Fabric', category: 'materials', amount: 65_000, fundedBy: 'creator', paidOnDay: 0 },
      { id: 'as-c2', label: 'Tailoring', category: 'labour', amount: 35_000, fundedBy: 'creator', paidOnDay: 0 },
    ],
    expectedPaymentDays: 12,
    status: 'active',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    activity: [{ id: 'as-a1', label: 'Project created', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString() }],
  },
];

export const allProjects: Project[] = [asoEbiProject, ...otherProjects];

export const demoFeedback: Feedback[] = [
  {
    id: 'fb-1',
    name: 'Sample feedback',
    craft: 'Fashion Designer',
    location: 'Lagos',
    quote:
      "I usually know how much I'll make, but I don't know when the money will actually be available.",
    avatar: '',
    verified: false,
    source: 'Sample / demo copy — not a real user',
    date: new Date().toISOString(),
  },
  {
    id: 'fb-2',
    name: 'Sample feedback',
    craft: 'Photographer',
    location: 'Abuja',
    quote:
      'A deposit always felt like a formality until I saw what happens to my account if the client pays late.',
    avatar: '',
    verified: false,
    source: 'Sample / demo copy — not a real user',
    date: new Date().toISOString(),
  },
  {
    id: 'fb-3',
    name: 'Sample feedback',
    craft: 'Event Planner',
    location: 'Port Harcourt',
    quote: "Every project made money. I just never knew when I'd actually have it.",
    avatar: '',
    verified: false,
    source: 'Sample / demo copy — not a real user',
    date: new Date().toISOString(),
  },
];

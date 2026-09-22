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

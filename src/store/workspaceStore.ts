import { create } from 'zustand';
import { clients as demoClients, kemiProfile, otherProjects as demoOtherProjects } from '../data/demoData';
import type { Client, CreativeProfile, PaymentStatus, Project } from '../types';
import { useProjectStore } from './projectStore';

/**
 * Everything the app shows that is not the single "working" project in projectStore:
 * the creator's profile, their other projects and their clients.
 *
 * It starts as the built-in demo data, so mock mode and "Explore the demo" behave exactly as before.
 * In live mode, loadLiveWorkspace() (services/workspace.ts) replaces it with the signed-in user's backend data;
 * resetToDemo() puts the demo back (sign-out, entering the demo).
 */
interface WorkspaceState {
  source: 'demo' | 'live';
  profile: CreativeProfile;
  otherProjects: Project[];
  clients: Client[];
  /** False only for a live account that has no projects yet. */
  hasProjects: boolean;
  hydrateLive: (data: { profile: CreativeProfile; projects: Project[]; clients: Client[] }) => void;
  resetToDemo: () => void;
  /** Live mode: makes `id` the editable working project (the previous one moves into otherProjects). */
  promote: (id: string) => void;
}

const paymentStatusOf = (project: Project): PaymentStatus => (project.status === 'completed' ? 'verified' : 'pending');

/** The project the dashboard and cash-flow screens work on: the newest one still in progress, else the newest. */
export function pickWorkingProject(projects: Project[]): Project | undefined {
  return projects.find((p) => p.status !== 'completed') ?? projects[0];
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  source: 'demo',
  profile: kemiProfile,
  otherProjects: demoOtherProjects,
  clients: demoClients,
  hasProjects: true,

  hydrateLive: ({ profile, projects, clients }) => {
    const working = pickWorkingProject(projects);
    if (working) useProjectStore.getState().hydrate(structuredClone(working), paymentStatusOf(working));
    set({
      source: 'live',
      profile,
      clients,
      otherProjects: projects.filter((p) => p.id !== working?.id),
      hasProjects: projects.length > 0,
    });
  },

  promote: (id) => {
    const { otherProjects } = useWorkspaceStore.getState();
    const next = otherProjects.find((p) => p.id === id);
    if (!next) return;
    const current = useProjectStore.getState().project;
    useProjectStore.getState().hydrate(structuredClone(next), paymentStatusOf(next));
    set({ otherProjects: [current, ...otherProjects.filter((p) => p.id !== id)] });
  },

  resetToDemo: () => {
    useProjectStore.getState().reset();
    set({ source: 'demo', profile: kemiProfile, otherProjects: demoOtherProjects, clients: demoClients, hasProjects: true });
  },
}));

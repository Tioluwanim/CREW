import { getClients } from './clients';
import { getProfile } from './profile';
import { getProjects } from './projects';
import { listInvoices } from './projectActions';
import { useWorkspaceStore, pickWorkingProject } from '../store/workspaceStore';
import { useProjectStore } from '../store/projectStore';

/** Loads the signed-in creator's profile, projects and clients from the backend into the app's stores. */
export async function loadLiveWorkspace(): Promise<void> {
  const [profile, projects, clients] = await Promise.all([getProfile(), getProjects(), getClients()]);
  useWorkspaceStore.getState().hydrateLive({ profile, projects, clients });

  // Whether the working project's invoice has already gone out decides what the Payments tab offers.
  const working = pickWorkingProject(projects);
  if (working) {
    try {
      const invoices = await listInvoices(working.id);
      const sent = invoices.some((i) => i.status === 'sent' || i.status === 'paid');
      if (sent) {
        const { project, paymentStatus, currentCash, hydrate } = useProjectStore.getState();
        if (project.id === working.id) hydrate(project, paymentStatus, currentCash, true);
      }
    } catch {
      // Not critical: the Payments tab simply offers "Approve & send", which reuses the existing invoice.
    }
  }
}

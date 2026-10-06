import { getClients } from './clients';
import { getProfile } from './profile';
import { getProjects } from './projects';
import { useWorkspaceStore } from '../store/workspaceStore';

/** Loads the signed-in creator's profile, projects and clients from the backend into the app's stores. */
export async function loadLiveWorkspace(): Promise<void> {
  const [profile, projects, clients] = await Promise.all([getProfile(), getProjects(), getClients()]);
  useWorkspaceStore.getState().hydrateLive({ profile, projects, clients });
}

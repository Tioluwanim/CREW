import { useCallback, useState } from 'react';
import { isLiveBackend } from '../../lib/demoMode';
import { useProjectStore } from '../../store/projectStore';
import * as api from '../../services/projectActions';
import type { PaymentStatus, Project } from '../../types';

/**
 * The project screens' edit handlers. In demo/mock mode they are the store's local actions,
 * unchanged. In live mode each one also writes to the backend and then re-reads the project, so
 * what is on screen is what is saved (and an edit the backend rejects snaps back, with the
 * backend's message in `error`).
 */

const paymentStatusOf = (p: Project): PaymentStatus => (p.status === 'completed' ? 'verified' : 'pending');

async function refresh(projectId: string): Promise<void> {
  const [project, invoices] = await Promise.all([api.fetchProject(projectId), api.listInvoices(projectId)]);
  const approved = invoices.some((i) => i.status === 'sent' || i.status === 'paid');
  useProjectStore.getState().hydrate(project, paymentStatusOf(project), useProjectStore.getState().currentCash, approved);
}

export function useProjectActions() {
  const store = useProjectStore();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (optimistic: () => void, remote: (id: string) => Promise<unknown>) => {
    const live = isLiveBackend();
    const id = useProjectStore.getState().project.id;
    optimistic();
    if (!live) return;
    setBusy(true);
    setError(null);
    try {
      await remote(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that change');
    } finally {
      try {
        await refresh(id); // also rolls back an edit the backend refused
      } catch {
        // keep what is on screen if the re-read fails
      }
      setBusy(false);
    }
  }, []);

  return {
    error,
    busy,
    clearError: () => setError(null),
    /** Runs a backend call for the working project, then re-reads it (live mode only; a no-op in the demo). */
    runRemote: (remote: (projectId: string) => Promise<unknown>) => run(() => undefined, remote),
    setDepositPct: (pct: number) => store.setDepositPct(pct), // local while dragging
    /** Call when the slider is released (live mode saves; demo does nothing extra). */
    commitDeposit: (pct: number) => run(() => store.setDepositPct(pct), (id) => api.saveDeposit(id, pct)),
    updateCost: (costId: string, amount: number) => store.updateCost(costId, amount), // local while typing
    commitCost: (costId: string, amount: number) => run(() => store.updateCost(costId, amount), (id) => api.saveCostAmount(id, costId, amount)),
    approveInvoice: () => run(() => store.approveInvoice(), (id) => api.approveAndSendInvoice(id)),
    simulatePayment: () => run(() => store.simulatePayment(), (id) => api.simulateSandboxPayment(id)),
    proposeChange: (title: string, amount: number) =>
      run(
        () => undefined,
        (id) => api.proposeChange(id, { title, amount }),
      ),
    // Creator-side classify/approve have no backend step (proposing a priced change is the creator's yes;
    // the client accepts on their link), so in live mode they stay local and the next refresh is truth.
    classifyChangeRequest: store.classifyChangeRequest,
    approveChangeRequest: store.approveChangeRequest,
    advanceMilestone: store.advanceMilestone,
  };
}

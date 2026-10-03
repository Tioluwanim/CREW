'use client';

import { useEffect, useState } from 'react';
import { Card, Pill, StatLabel, StatValue } from '../../components/ui/primitives';
import { getProjectWorkspace, resolveBackendProjectId, type BackendProjectWorkspace } from '../../services/projectWorkspace';

function value(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) return data[key];
  }
  return '—';
}

function currency(data: Record<string, unknown>) {
  return String(value(data, 'currency', 'projectCurrency'));
}

export function BackendWorkspacePanel({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [workspace, setWorkspace] = useState<BackendProjectWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    resolveBackendProjectId({ id: projectId, name: projectName })
      .then((backendId) => {
        if (!backendId) throw new Error('This project does not exist on the backend yet');
        return getProjectWorkspace(backendId);
      })
      .then((result) => {
        if (active) setWorkspace(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load backend project data');
      });
    return () => {
      active = false;
    };
  }, [projectId, projectName]);

  if (error) {
    return (
      <Card className="border-thread-600/20 bg-thread-100/40 p-5" role="alert">
        <p className="text-sm font-medium text-thread-600">Live project data unavailable</p>
        <p className="mt-1 text-xs text-ink-500">{error}</p>
      </Card>
    );
  }

  if (!workspace) {
    return <Card className="p-5"><p className="text-sm text-ink-500">Loading live project intelligence…</p></Card>;
  }

  const financials = workspace.financials;
  const reconciliation = workspace.reconciliation;
  const project = workspace.project;
  const stage = String(value(project, 'stage', 'status'));

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Backend source of truth</p>
          <h2 className="mt-1 font-display text-2xl">{String(value(project, 'name'))}</h2>
        </div>
        <Pill tone={stage === 'approved' || stage === 'released' ? 'verified' : 'default'}>{stage}</Pill>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="min-w-0"><StatLabel>Expected profit</StatLabel><StatValue tone="verified">{String(value(financials, 'expectedProfit'))} {currency(financials)}</StatValue></div>
        <div className="min-w-0"><StatLabel>Cash gap</StatLabel><StatValue tone="thread">{String(value(financials, 'cashGap'))} {currency(financials)}</StatValue></div>
        <div className="min-w-0"><StatLabel>Received</StatLabel><StatValue>{String(value(reconciliation, 'receivedNaira', 'received'))} {currency(reconciliation)}</StatValue></div>
        <div className="min-w-0"><StatLabel>Held</StatLabel><StatValue>{String(value(reconciliation, 'heldNaira', 'held'))} {currency(reconciliation)}</StatValue></div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-ink-900/10 p-3">
          <StatLabel>Forecast</StatLabel>
          <p className="mt-1 text-ink-700">Loaded from backend, including uncertainty bands.</p>
        </div>
        <div className="rounded-lg border border-ink-900/10 p-3">
          <StatLabel>Project timeline</StatLabel>
          <p className="mt-1 text-ink-700">{Array.isArray(workspace.timeline.events) ? workspace.timeline.events.length : '—'} recorded events.</p>
        </div>
        <div className="rounded-lg border border-ink-900/10 p-3">
          <StatLabel>DL prediction</StatLabel>
          <p className="mt-1 text-ink-700">{workspace.dlStatus.available ? 'Advisory model available.' : 'Not available yet.'}</p>
        </div>
      </div>
    </Card>
  );
}

import { describe, expect, it } from 'vitest';
import { adaptProject } from './adapt';

describe('adaptProject', () => {
  const backend = {
    id: 'p1', name: 'Shoot', clientId: 'c1', clientName: 'Zainab', craft: 'Photographer', revenue: 100000, depositPct: 40, costs: [],
    expectedPaymentDays: 14, status: 'active', createdAt: '2026-10-01T00:00:00Z', activity: [], stage: 'agreed',
    deliverables: [{ id: 'd1', title: '20 edited photos', status: 'pending' }],
    milestones: [{ id: 'm1', title: 'Deposit', amount: 40000, funded: 0, status: 'agreed' }],
    changeRequests: [
      { id: 'c1', title: 'Extra reel', amount: 15000, status: 'proposed', requestedBy: 'creator' },
      { id: 'c2', title: 'Retouch', amount: 0, status: 'accepted', requestedBy: 'creator' },
      { id: 'c3', title: 'Drone', amount: 20000, status: 'declined', requestedBy: 'creator' },
    ],
  };

  it('maps backend change requests onto the app shape', () => {
    const [extra, included, declined] = adaptProject(backend).changeRequests!;
    expect(extra).toMatchObject({ label: 'Extra reel', classification: 'extra', priceImpact: 15000, status: 'pending', creatorApproved: true, clientApproved: false });
    expect(included).toMatchObject({ classification: 'included', status: 'accepted', clientApproved: true });
    expect(declined.status).toBe('rejected');
  });

  it('maps milestones and deliverables', () => {
    const p = adaptProject(backend);
    expect(p.milestones![0]).toMatchObject({ label: 'Deposit', projectId: 'p1', status: 'agreed' });
    expect(p.scope![0]).toMatchObject({ label: '20 edited photos', status: 'locked' });
    expect(p.stage).toBe('agreed');
  });

  it('leaves the mock API shape untouched', () => {
    const mock = { ...backend, scope: [{ id: 's', label: 'x', quantity: 2, unit: 'video', status: 'locked' }],
      changeRequests: [{ id: 'x', projectId: 'p1', label: 'L', classification: null, priceImpact: 5, status: 'pending', creatorApproved: false, clientApproved: false, createdAt: 'now' }],
      milestones: [{ id: 'ms', projectId: 'p1', label: 'M', amount: 1, status: 'funded' }] };
    const p = adaptProject(mock);
    expect(p.scope![0].quantity).toBe(2);
    expect(p.changeRequests![0].label).toBe('L');
    expect(p.milestones![0].label).toBe('M');
  });
});

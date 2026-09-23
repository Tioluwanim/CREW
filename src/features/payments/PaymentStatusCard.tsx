'use client';

import { EcobankBadge } from '../../components/ui/EcobankBadge';
import { Button, Card, Pill } from '../../components/ui/primitives';
import { useProjectStore } from '../../store/projectStore';

export function PaymentStatusCard() {
  const status = useProjectStore((state) => state.paymentStatus);
  const simulatePayment = useProjectStore((state) => state.simulatePayment);
  const verified = status === 'verified';
  return <Card className="p-5"><div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium text-ink-700">Balance payment</span><Pill tone={verified ? 'verified' : 'default'}>{verified ? 'Verified' : 'Pending'}</Pill></div><div className="mb-4"><EcobankBadge /></div>{verified ? <p className="text-sm text-verified-600">Payment received and verified for this demo project.</p> : <Button onClick={simulatePayment}>Simulate client payment</Button>}</Card>;
}
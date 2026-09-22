import { Landmark } from 'lucide-react';

/**
 * CREW's payment verification is designed to run on Ecobank's sandbox
 * APIs as the primary rail. No real Ecobank integration exists in this
 * build — this badge says exactly that, honestly, rather than implying a
 * live bank connection. Swap the label (not the component's shape) the
 * day a real sandbox call backs it.
 */
export function EcobankBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-900/10 bg-ink-900/[0.03] px-2.5 py-1 text-[11px] font-medium text-ink-500">
      <Landmark size={12} strokeWidth={2} />
      Sandbox — Ecobank integration
    </span>
  );
}

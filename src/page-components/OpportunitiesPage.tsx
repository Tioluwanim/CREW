'use client';

import { useState } from 'react';
import { Card, Button, Pill } from '../components/ui/primitives';
import { EcobankBadge } from '../components/ui/EcobankBadge';

const CATEGORIES = [
  { name: 'Equipment financing', desc: 'For gear, studio equipment, or tools tied directly to your craft.' },
  { name: 'Insurance', desc: 'Coverage for equipment, liability, or project-specific risk.' },
  { name: 'Business financing', desc: 'Working capital sized to your actual project cash-flow pattern.' },
];

export function OpportunitiesPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Opportunities</h1>
        <p className="mt-1 text-sm text-ink-500">CREW does not lend you money.</p>
      </header>

      <Card className="mb-6 p-5">
        <p className="text-sm text-ink-700">
          When you choose to, CREW can help connect your business profile with relevant financial products. Nothing here
          is automatic, and nothing is shared without your explicit consent.
        </p>
        <div className="mt-3">
          <EcobankBadge />
        </div>
        <p className="mt-2 text-xs text-ink-500">
          CREW's business profile is designed to connect with Ecobank as an intended first financial partner — this is a
          stated design intent, not an existing partnership.
        </p>
      </Card>

      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <Card key={cat.name} className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="text-sm font-medium text-ink-900">{cat.name}</div>
              <div className="mt-0.5 text-xs text-ink-500">{cat.desc}</div>
            </div>
            <Pill>Not connected</Pill>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ConsentPage() {
  const [consent, setConsent] = useState({
    projectActivity: true,
    paymentActivity: true,
    businessPatterns: true,
    sharingLevel: 'never' as 'never' | 'ask_each_time' | 'specific_partners',
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Privacy &amp; consent</h1>
        <p className="mt-1 text-sm text-ink-500">What CREW can use, and what can be shared.</p>
      </header>

      <Card className="mb-6 p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-700">What CREW can use</h2>
        <div className="space-y-2">
          <ConsentToggle
            label="Project activity"
            checked={consent.projectActivity}
            onChange={(v) => setConsent({ ...consent, projectActivity: v })}
          />
          <ConsentToggle
            label="Payment activity"
            checked={consent.paymentActivity}
            onChange={(v) => setConsent({ ...consent, paymentActivity: v })}
          />
          <ConsentToggle
            label="Business patterns"
            checked={consent.businessPatterns}
            onChange={(v) => setConsent({ ...consent, businessPatterns: v })}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-700">What can be shared</h2>
        <div className="space-y-2">
          {(['never', 'ask_each_time', 'specific_partners'] as const).map((level) => (
            <label key={level} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="radio"
                name="sharing"
                checked={consent.sharingLevel === level}
                onChange={() => setConsent({ ...consent, sharingLevel: level })}
              />
              {level === 'never' ? 'Never' : level === 'ask_each_time' ? 'Only when I approve' : 'Specific partners'}
            </label>
          ))}
        </div>
        <Button variant="secondary" className="mt-4">
          Revoke access
        </Button>
      </Card>
    </div>
  );
}

function ConsentToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-ink-900/10 px-3 py-2.5 text-sm text-ink-700">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

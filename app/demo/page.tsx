'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { enterDemoSession } from '../../src/lib/demoMode';

// "Explore demo": start a demo session so every feature uses the built-in demo
// data (never the backend), then open the demo project.
export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    enterDemoSession();
    router.replace('/app/projects/project-lumo-deal');
  }, [router]);

  return <p className="p-8 text-sm text-ink-500">Opening the demo…</p>;
}

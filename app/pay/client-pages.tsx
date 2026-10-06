'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useLiveBackend } from '../../src/lib/demoMode';
import { kemiProject, otherProjects } from '../../src/data/demoData';

const ClientProjectPage = dynamic(() => import('../../src/page-components/ClientProjectPage').then((m) => m.ClientProjectPage), {
  ssr: false,
});
const SharedProjectPage = dynamic(() => import('../../src/page-components/SharedProjectPage').then((m) => m.SharedProjectPage), {
  ssr: false,
});

const DEMO_PROJECT_IDS = new Set([kemiProject.id, ...otherProjects.map((p) => p.id)]);

/**
 * Live backend: the path segment is a real share token. Mock/demo: the built-in demo client page.
 *
 * A demo project id always shows the demo page. The "View client link" button opens a NEW tab,
 * and a new tab does not inherit the demo session flag (sessionStorage is per tab), so without
 * this check the demo link would be looked up on the backend and fail.
 */
export function ClientProjectClientPage() {
  const live = useLiveBackend();
  const params = useParams<{ id?: string; token?: string }>();
  const key = params.token ?? params.id ?? '';
  const isDemoLink = DEMO_PROJECT_IDS.has(key);
  return live && key && !isDemoLink ? <SharedProjectPage token={key} /> : <ClientProjectPage />;
}

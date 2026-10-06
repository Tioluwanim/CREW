'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useLiveBackend } from '../../src/lib/demoMode';

const ClientProjectPage = dynamic(() => import('../../src/page-components/ClientProjectPage').then((m) => m.ClientProjectPage), {
  ssr: false,
});
const SharedProjectPage = dynamic(() => import('../../src/page-components/SharedProjectPage').then((m) => m.SharedProjectPage), {
  ssr: false,
});

/** Live backend: the path segment is a real share token. Mock/demo: the built-in demo client page. */
export function ClientProjectClientPage() {
  const live = useLiveBackend();
  const params = useParams<{ id?: string; token?: string }>();
  const key = params.token ?? params.id ?? '';
  return live && key ? <SharedProjectPage token={key} /> : <ClientProjectPage />;
}

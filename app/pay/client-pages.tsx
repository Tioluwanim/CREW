'use client';

import dynamic from 'next/dynamic';

const ClientProjectPage = dynamic(() => import('../../src/page-components/ClientProjectPage').then((m) => m.ClientProjectPage), {
  ssr: false,
});

export function ClientProjectClientPage() {
  return <ClientProjectPage />;
}

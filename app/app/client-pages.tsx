'use client';

import dynamic from 'next/dynamic';

const DashboardPage = dynamic(() => import('../../src/page-components/DashboardPage').then((module) => module.DashboardPage), {
  ssr: false,
});

export function DashboardClientPage() {
  return <DashboardPage />;
}
'use client';

import dynamic from 'next/dynamic';
const OnboardingPage = dynamic(() => import('../src/page-components/OnboardingPage').then((module) => module.OnboardingPage), {
  ssr: false,
});

export function OnboardingClientPage() {
  return <OnboardingPage />;
}
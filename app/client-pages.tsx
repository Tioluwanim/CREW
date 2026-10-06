'use client';

import dynamic from 'next/dynamic';
const OnboardingPage = dynamic(() => import('../src/page-components/OnboardingPage').then((module) => module.OnboardingPage), {
  ssr: false,
});

export function OnboardingClientPage() {
  return <OnboardingPage />;
}

const SignInPage = dynamic(() => import('../src/page-components/AuthPages').then((module) => module.SignInPage), { ssr: false });
const SignUpPage = dynamic(() => import('../src/page-components/AuthPages').then((module) => module.SignUpPage), { ssr: false });

export function SignInClientPage() {
  return <SignInPage />;
}

export function SignUpClientPage() {
  return <SignUpPage />;
}

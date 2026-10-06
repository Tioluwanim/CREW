'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/primitives';
import { USE_MOCK_API } from '../lib/apiConfig';
import { safeNextPath, useAccess } from '../lib/session';
import { login, register } from '../services/auth';

const inputClass =
  'w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2.5 text-sm text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bone-50 px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Link href="/" className="font-display text-2xl italic text-ink-900">
          CREW
        </Link>
        <h1 className="mt-8 font-display text-3xl text-ink-900">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-6 space-y-2 text-center text-sm text-ink-500">{footer}</div>
      </motion.div>
    </div>
  );
}

/** Without a backend there are no accounts: say so and point at the built-in demo instead of showing a dead form. */
function NoBackendNotice() {
  return (
    <AuthFrame
      title="No account needed here"
      subtitle="This copy of CREW isn't connected to a backend, so it runs on built-in demo data."
      footer={null}
    >
      <Link
        href="/demo"
        className="inline-flex w-full items-center justify-center rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-bone-50"
      >
        Explore the demo
      </Link>
    </AuthFrame>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-thread-600">
      {message}
    </p>
  );
}

export function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = useAccess();

  // Already signed in: nothing to do here. (Not while submitting; the submit handler picks the destination.)
  useEffect(() => {
    if (access === 'authed' && !busy) router.replace(safeNextPath(new URLSearchParams(window.location.search).get('next')));
  }, [access, busy, router]);

  if (USE_MOCK_API) return <NoBackendNotice />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace(safeNextPath(new URLSearchParams(window.location.search).get('next')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in to your CREW workspace."
      footer={
        <>
          <p>
            New to CREW?{' '}
            <Link href="/signup" className="font-medium text-ink-900 underline underline-offset-4">
              Create an account
            </Link>
          </p>
          <p>
            <Link href="/demo" className="underline underline-offset-4">
              Explore the demo instead
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password">
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <ErrorLine message={error} />
        <Button type="submit" disabled={busy || !email || !password} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function SignUpPage() {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const access = useAccess();

  useEffect(() => {
    if (access === 'authed' && !busy) router.replace('/app');
  }, [access, busy, router]);

  if (USE_MOCK_API) return <NoBackendNotice />;

  const passwordOk = password.length >= 8;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ email: email.trim(), password, ownerName: ownerName.trim(), businessName: businessName.trim() });
      router.replace('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account');
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Create your workspace"
      subtitle="Two minutes to set up. Then CREW works out your deposits and cash gaps from your real projects."
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/signin" className="font-medium text-ink-900 underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <input required autoComplete="name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Business or studio name">
          <input required autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password" hint={password && !passwordOk ? 'Use at least 8 characters.' : 'At least 8 characters.'}>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <ErrorLine message={error} />
        <Button type="submit" disabled={busy || !ownerName.trim() || !businessName.trim() || !email || !passwordOk} className="w-full">
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthFrame>
  );
}

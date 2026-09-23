import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';

// Route-level code splitting: the landing page (GSAP/Lenis/R3F-adjacent),
// the /app workspace (recharts/zustand-heavy), and onboarding each load
// only when visited, instead of one ~1MB bundle for every visitor.
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const CashFlowPage = lazy(() => import('./pages/CashFlowPage').then((m) => ({ default: m.CashFlowPage })));
const InvoicesPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.InvoicesPage })));
const ClientsPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.ClientsPage })));
const ProfitPage = lazy(() => import('./pages/SecondaryPages').then((m) => ({ default: m.ProfitPage })));
const CreateProjectPage = lazy(() => import('./pages/CreateProjectPage').then((m) => ({ default: m.CreateProjectPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const OpportunitiesPage = lazy(() => import('./pages/OpportunitiesPage').then((m) => ({ default: m.OpportunitiesPage })));
const ConsentPage = lazy(() => import('./pages/OpportunitiesPage').then((m) => ({ default: m.ConsentPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const queryClient = new QueryClient();

function RouteFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-bone-50" aria-hidden />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* /demo drops the judge straight into Amara's pre-populated project -- no auth wall exists in this build. */}
            <Route path="/demo" element={<Navigate to="/app/projects/project-asoebi" replace />} />

            <Route path="/app" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/new" element={<CreateProjectPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="cash-flow" element={<CashFlowPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="profit" element={<ProfitPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="opportunities" element={<OpportunitiesPage />} />
              <Route path="consent" element={<ConsentPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

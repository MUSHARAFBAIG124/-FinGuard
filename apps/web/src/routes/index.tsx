import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const AppLayout = React.lazy(() =>
  import('../components/layout/AppLayout').then((module) => ({ default: module.AppLayout })),
);
const DashboardPage = React.lazy(() =>
  import('../features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const AIGovernancePage = React.lazy(() =>
  import('../features/governance/AIGovernancePage').then((module) => ({
    default: module.AIGovernancePage,
  })),
);
const FraudOpsPage = React.lazy(() =>
  import('../features/fraud/FraudOpsPage').then((module) => ({ default: module.FraudOpsPage })),
);
const LoanApplicationsPage = React.lazy(() =>
  import('../features/loans/LoanApplicationsPage').then((module) => ({
    default: module.LoanApplicationsPage,
  })),
);
const HumanReviewPage = React.lazy(() =>
  import('../features/reviews/HumanReviewPage').then((module) => ({
    default: module.HumanReviewPage,
  })),
);
const SettingsPage = React.lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);
const LoginPage = React.lazy(() =>
  import('../features/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);

const PageFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-medium text-slate-200">
    Loading
  </div>
);

const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageFallback />}>{children}</Suspense>
);

// Guard: redirect to /login if not authenticated
const RequireAuth: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null; // wait for localStorage restore
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// Guard: redirect to / if already logged in
const RequireGuest: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
};

export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [
      {
        path: '/login',
        element: (
          <LazyPage>
            <LoginPage />
          </LazyPage>
        ),
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: (
          <LazyPage>
            <AppLayout />
          </LazyPage>
        ),
        children: [
          {
            index: true,
            element: (
              <LazyPage>
                <DashboardPage />
              </LazyPage>
            ),
          },
          {
            path: 'governance',
            element: (
              <LazyPage>
                <AIGovernancePage />
              </LazyPage>
            ),
          },
          {
            path: 'loans',
            element: (
              <LazyPage>
                <LoanApplicationsPage />
              </LazyPage>
            ),
          },
          {
            path: 'reviews',
            element: (
              <LazyPage>
                <HumanReviewPage />
              </LazyPage>
            ),
          },
          {
            path: 'fraud',
            element: (
              <LazyPage>
                <FraudOpsPage />
              </LazyPage>
            ),
          },
          {
            path: 'settings',
            element: (
              <LazyPage>
                <SettingsPage />
              </LazyPage>
            ),
          },
        ],
      },
    ],
  },
]);

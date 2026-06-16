export const plannedWorkspaceRoutes = [
  '/dashboard',
  '/loans',
  '/fraud-alerts',
  '/customers',
  '/analytics',
  '/admin',
] as const;

export type PlannedWorkspaceRoute = (typeof plannedWorkspaceRoutes)[number];

export const publicAuthRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
] as const;

export type PublicAuthRoute = (typeof publicAuthRoutes)[number];

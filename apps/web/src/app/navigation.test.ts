import { describe, expect, it } from 'vitest';

import { plannedWorkspaceRoutes, publicAuthRoutes } from './navigation';

describe('navigation contract', () => {
  it('separates protected workspace routes from public authentication routes', () => {
    expect(plannedWorkspaceRoutes).toContain('/dashboard');
    expect(plannedWorkspaceRoutes).toContain('/fraud-alerts');
    expect(publicAuthRoutes).toContain('/login');
    expect(publicAuthRoutes).toContain('/verify-email');
  });
});

# FinGuard Web

React, Vite, and TypeScript frontend for banking operations, customer loan applications, fraud monitoring, and executive analytics.

## Feature Structure

```text
src/
  app/             Application shell, providers, router composition
  components/      Shared reusable UI primitives and layout components
  features/        Feature modules grouped by business capability
  lib/             API clients, utility functions, auth helpers
  routes/          Route-level pages and guards
  styles/          Tailwind entry styles and design tokens
  tests/           Component and integration tests
```

React Query owns server state. React Router owns navigation. Business features should not import directly from unrelated feature internals.

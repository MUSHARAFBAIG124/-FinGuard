import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <div className="min-h-screen bg-brand-surface text-brand-ink">
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
        <section className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-primary">
            Phase 1 Architecture Baseline
          </p>
          <h1 className="mt-3 text-4xl font-semibold">FinGuard AI</h1>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            Enterprise banking, loan risk, fraud intelligence, and executive analytics platform.
          </p>
        </section>
      </main>
    </div>
  </React.StrictMode>,
);

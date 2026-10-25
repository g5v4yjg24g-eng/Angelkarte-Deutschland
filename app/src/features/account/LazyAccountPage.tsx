import { lazy, Suspense } from 'react';

// Kontoseite samt Supabase-Client erst laden, wenn sie geöffnet wird.
const AccountPage = lazy(() => import('./AccountPage').then((m) => ({ default: m.AccountPage })));

export function LazyAccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountPage />
    </Suspense>
  );
}

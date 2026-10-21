import { lazy, Suspense } from 'react';

// Sicherung (inkl. ZIP-Bibliothek) erst laden, wenn die Seite geöffnet wird.
const BackupPage = lazy(() => import('./BackupPage').then((m) => ({ default: m.BackupPage })));

export function LazyBackupPage() {
  return (
    <Suspense fallback={null}>
      <BackupPage />
    </Suspense>
  );
}

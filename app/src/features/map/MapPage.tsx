import { lazy, Suspense } from 'react';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';

// MapLibre (~230 KB gzip) wird erst mit der Kartenansicht geladen (Bundle-Budget, TEST_PLAN §4).
const MapView = lazy(() => import('./MapView'));

export function MapPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 'var(--space-4)' }}>
          <Notice>{de.map.loading}</Notice>
        </div>
      }
    >
      <MapView />
    </Suspense>
  );
}

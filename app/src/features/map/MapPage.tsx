import { de } from '../../i18n/de';
import { EmptyState } from '../../design/components/EmptyState';
import { MapIcon } from '../../design/icons';

// Platzhalter bis M3 (Deutschlandkarte mit MapLibre).
export function MapPage() {
  return (
    <EmptyState icon={<MapIcon size={32} />} title={de.map.emptyTitle} note={de.common.comingIn('M3')}>
      {de.map.emptyText}
    </EmptyState>
  );
}

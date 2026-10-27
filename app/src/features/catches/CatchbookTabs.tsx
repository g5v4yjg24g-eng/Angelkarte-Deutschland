// Umschalter Einträge | Statistik (Statistik liegt seit der Profilseite im Fangbuch, Entscheidung Nutzer 2026-10-27)
import { de } from '../../i18n/de';
import { TabLinks } from '../../design/components/TabLinks';

export const CatchbookTabs = () => (
  <TabLinks
    label={de.nav.catches}
    tabs={[
      { to: '/fangbuch', label: de.catches.entriesTab },
      { to: '/statistik', label: de.nav.stats },
    ]}
  />
);

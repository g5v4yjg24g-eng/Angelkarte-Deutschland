// Umschalter Knoten | Montagen (Mehr → Knoten & Montagen)
import { de } from '../../i18n/de';
import { TabLinks } from '../../design/components/TabLinks';

export const KnotTabs = () => (
  <TabLinks
    label={de.more.knots}
    tabs={[
      { to: '/mehr/knoten', label: de.knots.title },
      { to: '/mehr/montagen', label: de.rigs.title },
    ]}
  />
);

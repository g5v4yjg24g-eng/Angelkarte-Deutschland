import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { BookIcon } from '../../design/icons';
import { getDb } from '../../data/db';

export function CatchesPage() {
  // Bis zur Fangliste (M5) zumindest ehrlich zeigen, dass Einträge vorhanden sind (z. B. nach einem Import).
  const count = useLiveQuery(() =>
    getDb()
      .catches.filter((c) => !c.deletedAt)
      .count(),
  );
  const stored = (count ?? 0) > 0;
  return (
    <Page title={de.catches.title}>
      <EmptyState
        icon={<BookIcon size={32} />}
        title={stored ? de.catches.storedTitle(count ?? 0) : de.catches.emptyTitle}
        note={de.common.comingIn('M5')}
      >
        {stored ? de.catches.storedText : de.catches.emptyText}
      </EmptyState>
    </Page>
  );
}

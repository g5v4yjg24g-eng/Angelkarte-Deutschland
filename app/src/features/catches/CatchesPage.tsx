import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { BookIcon } from '../../design/icons';

export function CatchesPage() {
  return (
    <Page title={de.catches.title}>
      <EmptyState icon={<BookIcon size={32} />} title={de.catches.emptyTitle} note={de.common.comingIn('M5')}>
        {de.catches.emptyText}
      </EmptyState>
    </Page>
  );
}

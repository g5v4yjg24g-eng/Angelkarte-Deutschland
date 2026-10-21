import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { ChartIcon } from '../../design/icons';

export function StatsPage() {
  return (
    <Page title={de.stats.title}>
      <EmptyState icon={<ChartIcon size={32} />} title={de.stats.emptyTitle} note={de.common.comingIn('M6')}>
        {de.stats.emptyText}
      </EmptyState>
    </Page>
  );
}

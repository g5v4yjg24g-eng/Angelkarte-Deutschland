// Gespeicherte Beiträge (Paket 7b, /profil/gespeichert): nur für einen selbst sichtbar, zuletzt gespeichert zuerst.
// Nicht mehr sichtbare Beiträge (gelöscht, nicht mehr geteilt, blockiert) liefert der Server nicht mehr.
import { useCallback } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { EmptyState } from '../../design/components/EmptyState';
import { BookmarkIcon } from '../../design/icons';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { FeedList } from './FeedPage';

const t = de.feed;

export function SavedPostsPage() {
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const load = useCallback((before?: string) => account.savedPosts(before), [account]);
  return (
    <Page title={t.savedTitle} back="/profil">
      {signedIn ? (
        <FeedList
          load={load}
          cursorOf={(p) => p.savedAt ?? p.createdAt}
          empty={
            <EmptyState icon={<BookmarkIcon size={32} />} title={t.savedEmptyTitle}>
              {t.savedEmptyText}
            </EmptyState>
          }
        />
      ) : (
        <>
          <Notice>{t.savedSignedOut}</Notice>
          <Link to="/mehr/konto">{t.toAccount}</Link>
        </>
      )}
    </Page>
  );
}

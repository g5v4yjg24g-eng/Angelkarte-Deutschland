// Beiträge einer anderen Person zum Durchscrollen (Wunsch Nutzer 2026-11-10, wie beim eigenen Profil): Tipp auf eine
// Kachel im Profil öffnet diese Liste ab dem gewählten Beitrag, darunter die älteren. Sichtbarkeit entscheidet der
// Server (user_posts); die Liste ist dieselbe wie im Feed (Gefällt mir, Kommentare, Speichern, Melden).
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { FeedIcon } from '../../design/icons';
import type { PublicProfile } from '../../domain/userProfile';
import { useProviders } from '../../ports/providersContext';
import { FeedList } from '../feed/FeedPage';
import { startCursor } from './userPostsLink';

const t = de.userProfile;

export function UserPostsPage() {
  const { username = '' } = useParams();
  const [params] = useSearchParams();
  const { account } = useProviders();
  const [profile, setProfile] = useState<PublicProfile | null>();
  const back = `/profil/nutzer/${encodeURIComponent(username)}`;
  const from = startCursor(params.get('ab'));

  useEffect(() => {
    let live = true;
    account
      .userProfile(username)
      .then((p) => live && setProfile(p ?? null))
      .catch(() => live && setProfile(null));
    return () => {
      live = false;
    };
  }, [account, username]);

  const userId = profile?.userId;
  const load = useCallback(
    (before?: string) => (userId ? account.userPosts(userId, before ?? from) : Promise.resolve([])),
    [account, userId, from],
  );

  if (profile === undefined)
    return (
      <Page title={t.title} back={back}>
        <Notice>{t.loading}</Notice>
      </Page>
    );
  if (profile === null)
    return (
      <Page title={t.title} back={back}>
        <Notice>{t.notFound}</Notice>
      </Page>
    );
  return (
    <Page title={t.postsPageTitle} back={back}>
      <FeedList
        load={load}
        cursorOf={(x) => x.createdAt}
        empty={
          <EmptyState icon={<FeedIcon size={32} />} title={t.emptyTitle}>
            {t.emptyText}
          </EmptyState>
        }
      />
    </Page>
  );
}

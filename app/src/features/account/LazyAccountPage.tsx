import { lazy, Suspense } from 'react';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { accountOpen } from './availability';

// Kontoseite samt Supabase-Client erst laden, wenn sie geöffnet wird.
const AccountPage = lazy(() => import('./AccountPage').then((m) => ({ default: m.AccountPage })));

/** Solange das Konto nicht freigeschaltet ist: Hinweis „Demnächst“, ohne Supabase zu laden. */
function ComingSoon() {
  const t = de.account;
  return (
    <Page title={t.title} back="/mehr">
      <Notice>
        <strong>{t.comingSoonTitle}</strong> {t.comingSoon}
      </Notice>
    </Page>
  );
}

export function LazyAccountPage() {
  if (!accountOpen()) return <ComingSoon />;
  return (
    <Suspense fallback={null}>
      <AccountPage />
    </Suspense>
  );
}

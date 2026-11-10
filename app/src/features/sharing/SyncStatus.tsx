// Stand der Sicherung auf dem Server (zentrale Bildspeicherung, Freigabe Nutzer 2026-11-10): ohne Pop-ups –
// im Profil nur, solange etwas offen ist (`compact`), unter Einstellungen immer.
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { syncSummary } from '../../domain/postSync';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import { Section } from '../../design/components/Page';
import { useProviders } from '../../ports/providersContext';
import { useStoredUserId } from '../badges/badgeStore';

const t = de.profile;

function useSummary() {
  const { account } = useProviders();
  const stored = useStoredUserId();
  const userId = account.enabled ? stored : undefined;
  const summary = useLiveQuery(
    async () => (userId ? syncSummary(await getDb().posts.toArray(), userId) : undefined),
    [userId],
  );
  return { userId, summary };
}

function lines(s: NonNullable<ReturnType<typeof useSummary>['summary']>): string[] {
  const out: string[] = [];
  if (s.saved === s.total) out.push(t.syncAllSaved(s.total));
  else if (s.waiting) out.push(t.syncProgress(s.saved, s.total));
  if (s.failed) out.push(t.syncFailed(s.failed));
  if (s.missing) out.push(t.syncMissing(s.missing));
  return out;
}

/** Im Profil: nur sichtbar, solange noch nicht alles gesichert ist */
export function SyncStatusNotice() {
  const { userId, summary } = useSummary();
  if (!userId || !summary || summary.saved === summary.total) return null;
  return (
    <Notice tone={summary.failed || summary.missing ? 'warning' : 'info'}>{lines(summary).join(' ')}</Notice>
  );
}

/** Einstellungen: Stand immer anzeigen */
export function SyncStatusSection() {
  const { userId, summary } = useSummary();
  return (
    <Section title={t.syncTitle}>
      {!userId ? (
        <p className="muted">{t.syncSignedOut}</p>
      ) : (
        summary && (
          <p className="muted" role="status">
            {lines(summary).join(' ')}
          </p>
        )
      )}
    </Section>
  );
}

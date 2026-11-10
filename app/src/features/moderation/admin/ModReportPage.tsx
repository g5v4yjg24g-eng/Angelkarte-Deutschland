// Eine Meldung (Mehr → Moderation → Meldung): Grund, Inhalt mit Fotos, beteiligte Konten und Aktionen.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { Toast } from '../../../design/components/Toast';
import type { BanDuration, ModContent, ModReport, ModUser } from '../../../domain/modAdmin';
import { useProviders } from '../../../ports/providersContext';
import { ModActionSheet, type ModAction } from './ModActions';
import { modDate, modErrorText } from './modErrors';
import { useIsModerator } from './useIsModerator';
import { ADMIN_BASE, adminUser } from './adminPaths';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;

export function ModReportPage() {
  const { id = '' } = useParams();
  const { account } = useProviders();
  const moderator = useIsModerator();
  const [report, setReport] = useState<ModReport | null>();
  const [content, setContent] = useState<ModContent | null>();
  const [user, setUser] = useState<ModUser>();
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [action, setAction] = useState<ModAction>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [toast, setToast] = useState<string>();

  const load = useCallback(async () => {
    try {
      const r = (await account.modReports('all')).find((x) => x.id === id) ?? null;
      setReport(r);
      if (!r) return;
      if (r.targetUserId) setUser(await account.modUser(r.targetUserId));
      if (r.kind === 'user') {
        setContent(null);
        return;
      }
      const c = (await account.modContent(r.kind, r.targetId)) ?? null;
      setContent(c);
      setPhotos(c?.photoPaths.length ? await account.modPhotoUrls(c.photoPaths) : []);
    } catch (e) {
      setError(modErrorText(e));
    }
  }, [account, id]);

  useEffect(() => {
    if (!moderator) return;
    // erst nach dem Zeichnen laden (Zustand wird nur asynchron gesetzt)
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [moderator, load]);

  if (moderator === false)
    return (
      <Page title={t.reportTitle} back="/mehr">
        <Notice>{t.notModerator}</Notice>
      </Page>
    );
  if (error)
    return (
      <Page title={t.reportTitle} back={`${ADMIN_BASE}/meldungen`}>
        <Notice tone="error">{error}</Notice>
      </Page>
    );
  if (report === undefined)
    return (
      <Page title={t.reportTitle} back={`${ADMIN_BASE}/meldungen`}>
        <p className="muted">{t.loading}</p>
      </Page>
    );
  if (report === null)
    return (
      <Page title={t.reportTitle} back={`${ADMIN_BASE}/meldungen`}>
        <Notice>{t.errors.notFound}</Notice>
      </Page>
    );

  const targetName = report.targetName ?? user?.displayName ?? '–';
  const run = async (note: string, days?: BanDuration) => {
    if (!action) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const who = report.targetUserId ?? '';
      if (action.kind === 'delete' && report.kind !== 'user')
        await account.modDeleteContent(
          report.kind,
          report.targetId,
          content?.photoPaths ?? [],
          report.id,
          note,
        );
      if (action.kind === 'warn') await account.modWarn(who, note, report.id);
      if (action.kind === 'resolve') await account.modResolve(report.id, note);
      if (action.kind === 'ban') await account.modBan(who, days ?? null, note, report.id);
      if (action.kind === 'unban') await account.modUnban(who, note);
      setToast(t.done_[action.kind]);
      setAction(undefined);
      await load();
    } catch (e) {
      setActionError(modErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.reportTitle} back={`${ADMIN_BASE}/meldungen`}>
      <dl className={styles.facts}>
        <dt>{t.kinds[report.kind]}</dt>
        <dd>
          <span className={report.status === 'open' ? styles.tagDanger : styles.tag}>
            {report.status === 'open' ? t.statusOpen : t.statusDone}
          </span>
        </dd>
        <dt>{t.reason}</dt>
        <dd>{de.moderation.reasons[report.reason as keyof typeof de.moderation.reasons] ?? report.reason}</dd>
        {report.details && (
          <>
            <dt>{t.details}</dt>
            <dd>{report.details}</dd>
          </>
        )}
        <dt>{t.reportedBy}</dt>
        <dd>{report.reporterName ?? '–'}</dd>
        <dt>{t.against}</dt>
        <dd>
          {targetName}
          {report.targetUsername && ` (${t.handle(report.targetUsername)})`}
          {user?.banned && <span className={styles.tagDanger}> {t.banned}</span>}
        </dd>
        <dt>{t.reportedAt}</dt>
        <dd>{modDate(report.createdAt)}</dd>
      </dl>
      {report.openAgainst > 1 && <Notice>{t.openAgainst(report.openAgainst)}</Notice>}

      {report.kind !== 'user' && (
        <Section title={t.content}>
          {content === undefined && <p className="muted">{t.loading}</p>}
          {content === null && <p className="muted">{t.contentGone}</p>}
          {content && (
            <>
              {report.kind === 'comment' && content.extra && (
                <p className="muted">{t.onPost(content.extra)}</p>
              )}
              {report.kind === 'spot' && content.extra && <p>{t.spotName(content.extra)}</p>}
              <p className={styles.quote}>{content.body || t.noText}</p>
              {report.kind === 'post' && photos.length > 0 && (
                <ul className={styles.photos}>
                  {photos.map((url, i) => (
                    <li key={i}>{url && <img src={url} alt={t.photo(i + 1)} />}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Section>
      )}

      {report.targetUserId && (
        <p>
          <Link to={adminUser(report.targetUserId)}>{t.openUser}</Link>
        </p>
      )}

      <Section title={t.actions}>
        <div className={styles.buttons}>
          {content && (
            <Button variant="danger" onClick={() => setAction({ kind: 'delete' })}>
              {t.deleteContent}
            </Button>
          )}
          {report.targetUserId && (
            <>
              <Button variant="secondary" onClick={() => setAction({ kind: 'warn' })}>
                {t.warn}
              </Button>
              {user?.banned ? (
                <Button variant="secondary" onClick={() => setAction({ kind: 'unban', name: targetName })}>
                  {t.unban}
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setAction({ kind: 'ban', name: targetName })}>
                  {t.ban}
                </Button>
              )}
            </>
          )}
          {report.status === 'open' && (
            <Button onClick={() => setAction({ kind: 'resolve' })}>{t.resolve}</Button>
          )}
        </div>
      </Section>
      <ModActionSheet
        key={action?.kind ?? 'none'}
        action={action}
        busy={busy}
        error={actionError}
        onCancel={() => {
          setAction(undefined);
          setActionError(undefined);
        }}
        onConfirm={(note, days) => void run(note, days)}
      />
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

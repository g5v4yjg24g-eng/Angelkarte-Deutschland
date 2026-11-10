// Admin → Meldungen → Meldung (Meldungsverwaltung, Wunsch Nutzer 2026-11-10): Grund, Stand, Inhalt mit Fotos,
// beteiligte Konten, Verlauf und Entscheidungen. Nur sinnvolle Aktionen je Art; jede Aktion mit Bestätigung, Eingriffe
// nur mit Begründung. Die meldende Person wird erst auf Knopfdruck gezeigt (wird protokolliert).
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { Toast } from '../../../design/components/Toast';
import type {
  BanDuration,
  ModContent,
  ModLogEntry,
  ModPostState,
  ModReport,
  ModReporter,
  ModUser,
} from '../../../domain/modAdmin';
import { useProviders } from '../../../ports/providersContext';
import { ModActionSheet, type ModAction } from './ModActions';
import { banUser, modActionErrorText, modDate, modErrorText } from './modErrors';
import { ADMIN_BASE, adminUser } from './adminPaths';
import { StatusTag } from './ModerationPage';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;
const r = t.reports;

export function ModReportPage() {
  const { id = '' } = useParams();
  const { account } = useProviders();
  const [report, setReport] = useState<ModReport | null>();
  const [content, setContent] = useState<ModContent | null>();
  const [postState, setPostState] = useState<ModPostState>();
  const [user, setUser] = useState<ModUser>();
  const [photos, setPhotos] = useState<string[]>([]);
  const [history, setHistory] = useState<ModLogEntry[]>();
  const [reporter, setReporter] = useState<ModReporter | null>();
  const [error, setError] = useState<string>();
  const [action, setAction] = useState<ModAction>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [toast, setToast] = useState<string>();

  const load = useCallback(async () => {
    try {
      const rep = (await account.modReports('all')).find((x) => x.id === id) ?? null;
      setReport(rep);
      if (!rep) return;
      setHistory(await account.modReportLog(rep.id).catch(() => []));
      if (rep.targetUserId) setUser(await account.modUser(rep.targetUserId));
      if (rep.kind === 'user') {
        setContent(null);
        return;
      }
      const c = (await account.modContent(rep.kind, rep.targetId)) ?? null;
      setContent(c);
      if (rep.kind === 'post' && c)
        setPostState(await account.modPostState(rep.targetId).catch(() => undefined));
      setPhotos(c?.photoPaths.length ? await account.modPhotoUrls(c.photoPaths) : []);
    } catch (e) {
      setError(modErrorText(e));
    }
  }, [account, id]);

  useEffect(() => {
    // erst nach dem Zeichnen laden (Zustand wird nur asynchron gesetzt)
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const back = `${ADMIN_BASE}/meldungen`;
  if (error)
    return (
      <Page title={t.reportTitle} back={back}>
        <Notice tone="error">{error}</Notice>
      </Page>
    );
  if (report === undefined)
    return (
      <Page title={t.reportTitle} back={back}>
        <p className="muted">{t.loading}</p>
      </Page>
    );
  if (report === null)
    return (
      <Page title={t.reportTitle} back={back}>
        <Notice>{t.errors.notFound}</Notice>
      </Page>
    );

  const targetName = report.targetName ?? user?.displayName ?? '–';
  const hidden = !!postState?.hiddenAt;
  const done = report.status === 'done';

  /** Stand direkt setzen (ohne Fenster): in Bearbeitung nehmen, wieder öffnen */
  const setStatus = async (status: 'in_progress' | 'open') => {
    setBusy(true);
    try {
      await account.modSetReportStatus(report.id, status);
      setToast(r.done[status]);
      await load();
    } catch (e) {
      setToast(modErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const run = async (note: string, days?: BanDuration, password?: string) => {
    if (!action) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const who = report.targetUserId ?? '';
      let message: string;
      switch (action.kind) {
        case 'delete':
          if (report.kind === 'user') return;
          await account.modDeleteContent(
            report.kind,
            report.targetId,
            content?.photoPaths ?? [],
            report.id,
            note,
          );
          message = t.done_.delete;
          break;
        case 'hide':
          await account.modHidePost(report.targetId, report.id, note);
          message = r.done.hide;
          break;
        case 'restore':
          await account.modRestorePost(report.targetId, report.id, note);
          message = r.done.restore;
          break;
        case 'noViolation':
          await account.modSetReportStatus(report.id, 'done', note || r.noViolationTitle);
          message = r.done.noViolation;
          break;
        case 'resolve':
          await account.modSetReportStatus(report.id, 'done', note);
          message = t.done_.resolve;
          break;
        case 'warn':
          await account.modAddWarning(
            who,
            note,
            report.id,
            report.kind === 'post' ? report.targetId : undefined,
          );
          message = t.done_.warn;
          break;
        case 'ban':
          await banUser(account, who, days ?? null, note, password, report.id);
          message = t.done_.ban;
          break;
        case 'unban':
          await account.modUnban(who, note);
          message = t.done_.unban;
          break;
        default:
          return;
      }
      setToast(message);
      setAction(undefined);
      await load();
    } catch (e) {
      setActionError(modActionErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.reportTitle} back={back}>
      <dl className={styles.facts}>
        <dt>{t.kinds[report.kind]}</dt>
        <dd>
          <StatusTag status={report.status} />
          {hidden && <span className={styles.tag}> {r.hidden}</span>}
        </dd>
        <dt>{t.reason}</dt>
        <dd>{de.moderation.reasons[report.reason as keyof typeof de.moderation.reasons] ?? report.reason}</dd>
        {report.details && (
          <>
            <dt>{t.details}</dt>
            <dd>{report.details}</dd>
          </>
        )}
        <dt>{t.against}</dt>
        <dd>
          {targetName}
          {report.targetUsername && ` (${t.handle(report.targetUsername)})`}
          {user?.banned && <span className={styles.tagDanger}> {t.banned}</span>}
        </dd>
        <dt>{t.reportedAt}</dt>
        <dd>{modDate(report.createdAt)}</dd>
        <dt>{r.reporter}</dt>
        <dd>
          {reporter === undefined ? (
            <>
              <Button
                variant="ghost"
                onClick={() =>
                  void account
                    .modReportReporter(report.id)
                    .then((p) => setReporter(p ?? null))
                    .catch((e: unknown) => setToast(modErrorText(e)))
                }
              >
                {r.showReporter}
              </Button>
              <span className={`muted ${styles.small}`}>{r.reporterHint}</span>
            </>
          ) : (
            <>
              {reporter?.displayName ?? '–'}
              {reporter?.username && ` (${t.handle(reporter.username)})`}
            </>
          )}
        </dd>
        {report.handledByName && (
          <>
            <dt>{r.statusFilter}</dt>
            <dd>{r.handled(report.handledByName, report.handledAt ? modDate(report.handledAt) : '')}</dd>
          </>
        )}
      </dl>
      {(report.sameTarget ?? 1) > 1 && <Notice>{r.sameTarget(report.sameTarget ?? 1)}</Notice>}
      {report.openAgainst > 1 && <Notice>{t.openAgainst(report.openAgainst)}</Notice>}

      {report.kind !== 'user' && (
        <Section title={t.content}>
          {content === undefined && <p className="muted">{t.loading}</p>}
          {content === null && <p className="muted">{t.contentGone}</p>}
          {content && (
            <>
              {hidden && <Notice tone="warning">{r.hiddenInfo(postState?.hiddenReason ?? '–')}</Notice>}
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

      <Section title={r.history}>
        {history === undefined && <p className="muted">{t.loading}</p>}
        {history && history.length === 0 && <p className="muted">{r.noHistory}</p>}
        {history && history.length > 0 && (
          <ol className={styles.timeline}>
            {history.map((h, i) => (
              <li key={i}>
                <strong>{t.logActions[h.action] ?? h.action}</strong>
                {h.detail && `: ${h.detail}`}
                <span className="muted">
                  {' '}
                  · {modDate(h.createdAt)}
                  {h.moderatorName && ` · ${t.byModerator(h.moderatorName)}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={r.decision}>
        <div className={styles.buttons}>
          {report.status === 'open' && (
            <Button variant="secondary" disabled={busy} onClick={() => void setStatus('in_progress')}>
              {r.startWork}
            </Button>
          )}
          {done && (
            <Button variant="secondary" disabled={busy} onClick={() => void setStatus('open')}>
              {r.reopen}
            </Button>
          )}
          {!done && (
            <>
              <Button variant="secondary" onClick={() => setAction({ kind: 'noViolation' })}>
                {r.noViolation}
              </Button>
              <Button onClick={() => setAction({ kind: 'resolve' })}>{t.resolve}</Button>
            </>
          )}
        </div>
      </Section>

      {content && (
        <Section title={r.contentActions}>
          <div className={styles.buttons}>
            {report.kind === 'post' &&
              (hidden ? (
                <Button variant="secondary" onClick={() => setAction({ kind: 'restore' })}>
                  {r.restore}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setAction({ kind: 'hide' })}>
                  {r.hide}
                </Button>
              ))}
            <Button variant="danger" onClick={() => setAction({ kind: 'delete' })}>
              {r.remove}
            </Button>
          </div>
        </Section>
      )}

      {report.targetUserId && (
        <Section title={r.personActions}>
          <div className={styles.buttons}>
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
          </div>
        </Section>
      )}

      <ModActionSheet
        key={action?.kind ?? 'none'}
        action={action}
        busy={busy}
        error={actionError}
        onCancel={() => {
          setAction(undefined);
          setActionError(undefined);
        }}
        onConfirm={(note, days, password) => void run(note, days, password)}
      />
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

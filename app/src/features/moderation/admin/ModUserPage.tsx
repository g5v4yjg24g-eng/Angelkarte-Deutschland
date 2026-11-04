// Ein Konto im Moderationsbereich: Sperrstatus, alle geteilten Inhalte (einzeln löschbar), Protokoll,
// Sperren / Sperre aufheben.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { Toast } from '../../../design/components/Toast';
import {
  banRemaining,
  type BanDuration,
  type ModLogEntry,
  type ModUser,
  type ModUserItem,
} from '../../../domain/modAdmin';
import { useProviders } from '../../../ports/providersContext';
import { ModActionSheet, type ModAction } from './ModActions';
import { modDate, modErrorText } from './modErrors';
import { useIsModerator } from './useIsModerator';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;

export function ModUserPage() {
  const { uid = '' } = useParams();
  const { account } = useProviders();
  const moderator = useIsModerator();
  const [user, setUser] = useState<ModUser | null>();
  const [items, setItems] = useState<ModUserItem[]>([]);
  const [log, setLog] = useState<ModLogEntry[]>([]);
  const [error, setError] = useState<string>();
  const [action, setAction] = useState<ModAction>();
  const [target, setTarget] = useState<ModUserItem>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [toast, setToast] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [u, i, l] = await Promise.all([
        account.modUser(uid),
        account.modUserContent(uid),
        account.modUserLog(uid),
      ]);
      setUser(u ?? null);
      setItems(i);
      setLog(l);
    } catch (e) {
      setError(modErrorText(e));
    }
  }, [account, uid]);

  useEffect(() => {
    if (!moderator) return;
    // erst nach dem Zeichnen laden (Zustand wird nur asynchron gesetzt)
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [moderator, load]);

  if (moderator === false)
    return (
      <Page title={t.userTitle} back="/mehr">
        <Notice>{t.notModerator}</Notice>
      </Page>
    );
  if (error || user === null)
    return (
      <Page title={t.userTitle} back="/mehr/moderation">
        <Notice tone="error">{error ?? t.errors.notFound}</Notice>
      </Page>
    );
  if (!user)
    return (
      <Page title={t.userTitle} back="/mehr/moderation">
        <p className="muted">{t.loading}</p>
      </Page>
    );

  const left = banRemaining(user.banUntil);
  const run = async (note: string, days?: BanDuration) => {
    if (!action) return;
    setBusy(true);
    setActionError(undefined);
    try {
      if (action.kind === 'delete' && target)
        await account.modDeleteContent(target.kind, target.id, target.photoPaths, undefined, note);
      if (action.kind === 'warn') await account.modWarn(user.userId, note);
      if (action.kind === 'ban') await account.modBan(user.userId, days ?? null, note);
      if (action.kind === 'unban') await account.modUnban(user.userId, note);
      setToast(t.done_[action.kind as keyof typeof t.done_]);
      setAction(undefined);
      setTarget(undefined);
      await load();
    } catch (e) {
      setActionError(modErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={user.displayName} back="/mehr/moderation">
      <div className={styles.item}>
        <p>
          <strong>{user.displayName}</strong> <span className="muted">{t.handle(user.username)}</span>
        </p>
        <p className="muted">{t.joined(modDate(user.joined))}</p>
        <p>{t.counts(user.posts, user.comments, user.spots)}</p>
        <p>{t.reportsAgainst(user.reportsAgainst)}</p>
        {user.banned && (
          <p>
            <span className={styles.tagDanger}>
              {user.banUntil ? t.bannedUntil(modDate(user.banUntil)) : t.bannedForever}
            </span>{' '}
            {left && <span className="muted">{t.remaining(left.days, left.hours)}</span>}
            {user.banReason && <span className="muted"> · {user.banReason}</span>}
          </p>
        )}
      </div>
      <div className={styles.buttons}>
        <Button variant="secondary" onClick={() => setAction({ kind: 'warn' })}>
          {t.warn}
        </Button>
        {user.banned ? (
          <Button onClick={() => setAction({ kind: 'unban', name: user.displayName })}>{t.unban}</Button>
        ) : (
          <Button variant="danger" onClick={() => setAction({ kind: 'ban', name: user.displayName })}>
            {t.ban}
          </Button>
        )}
      </div>

      <Section title={t.itemsTitle}>
        {items.length === 0 ? (
          <p className="muted">{t.noItems}</p>
        ) : (
          <ul className={styles.list}>
            {items.map((i) => (
              <li key={`${i.kind}-${i.id}`} className={styles.item}>
                <span className={styles.row}>
                  <strong>{t.kinds[i.kind]}</strong>
                  <span className="muted">{modDate(i.createdAt)}</span>
                </span>
                <p className={styles.quote}>{i.body || t.noText}</p>
                {i.photoPaths.length > 0 && <p className="muted">{t.photo(i.photoPaths.length)}</p>}
                <div className={styles.buttons}>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setTarget(i);
                      setAction({ kind: 'delete' });
                    }}
                  >
                    {t.deleteContent}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.logTitle}>
        {log.length === 0 ? (
          <p className="muted">{t.noLog}</p>
        ) : (
          <ul className={styles.list}>
            {log.map((l, n) => (
              <li key={n} className={styles.item}>
                <span className={styles.row}>
                  <strong>{t.logActions[l.action] ?? l.action}</strong>
                  <span className="muted">{modDate(l.createdAt)}</span>
                </span>
                {l.detail && <p>{l.detail}</p>}
                {l.moderatorName && <p className="muted">{t.byModerator(l.moderatorName)}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <ModActionSheet
        key={action?.kind ?? 'none'}
        action={action}
        busy={busy}
        error={actionError}
        onCancel={() => {
          setAction(undefined);
          setTarget(undefined);
          setActionError(undefined);
        }}
        onConfirm={(note, days) => void run(note, days)}
      />
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

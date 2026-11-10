// Admin → Verwaltung → Einsprüche (Entscheidung Nutzer 2026-11-10): Einsprüche gegen Sperren nach Stand. Annehmen
// hebt die Sperre auf (Mail wie beim Aufheben), Ablehnen braucht eine Begründung (geht per Mail an die Person).
// Entschieden ist entschieden; jede Entscheidung steht im Protokoll. Der Server prüft alles selbst.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { TextArea } from '../../../design/components/Field';
import { Notice } from '../../../design/components/Notice';
import { SegmentedControl } from '../../../design/components/SegmentedControl';
import { Sheet } from '../../../design/components/Sheet';
import { Toast } from '../../../design/components/Toast';
import type { AppealStatus, ModAppeal } from '../../../domain/appeals';
import { useProviders } from '../../../ports/providersContext';
import { ADMIN_BASE, adminUser } from './adminPaths';
import { modDate, modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.appeals;
type Filter = AppealStatus | 'all';
const FILTERS = (['open', 'accepted', 'rejected', 'all'] as const).map((value) => ({
  value,
  label: t.states[value],
}));

export function AppealsAdminPage() {
  const { account } = useProviders();
  const [filter, setFilter] = useState<Filter>('open');
  const [loaded, setLoaded] = useState<{ filter: Filter; list?: ModAppeal[]; error?: string }>();
  const [decide, setDecide] = useState<{ appeal: ModAppeal; accept: boolean }>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const list = loaded?.filter === filter ? loaded.list : undefined;
  const error = loaded?.filter === filter ? loaded.error : undefined;

  const load = useCallback(
    (f: Filter) =>
      account
        .modAppeals(f)
        .then((l) => setLoaded({ filter: f, list: l }))
        .catch((e: unknown) => setLoaded({ filter: f, error: modErrorText(e) })),
    [account],
  );

  useEffect(() => {
    // erst nach dem Zeichnen laden (Zustand wird nur asynchron gesetzt)
    const timer = setTimeout(() => void load(filter), 0);
    return () => clearTimeout(timer);
  }, [load, filter]);

  const close = () => {
    setDecide(undefined);
    setNote('');
    setActionError(undefined);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!decide) return;
    setBusy(true);
    setActionError(undefined);
    try {
      await account.modDecideAppeal(decide.appeal.id, decide.accept, note.trim() || undefined);
      setToast(decide.accept ? t.accepted : t.rejected);
      close();
      await load(filter);
    } catch (err) {
      setActionError(modErrorText(err));
    } finally {
      setBusy(false);
    }
  };
  const needsNote = decide ? !decide.accept : false;

  return (
    <Page title={t.title} back={`${ADMIN_BASE}/verwaltung`}>
      <p className="muted">{t.intro}</p>
      <SegmentedControl label={t.filter} options={FILTERS} value={filter} onChange={setFilter} />
      {error && <Notice tone="error">{error}</Notice>}
      {!list && !error && <p className="muted">{de.modAdmin.loading}</p>}
      {list?.length === 0 && <p className="muted">{filter === 'open' ? t.emptyOpen : t.empty}</p>}
      {list && list.length > 0 && (
        <ul className={styles.list}>
          {list.map((a) => (
            <li key={a.id} className={styles.item}>
              <span className={styles.row}>
                <strong>
                  {a.displayName ?? '–'}
                  {a.username && <span className="muted"> {de.modAdmin.handle(a.username)}</span>}
                </strong>
                <span className={a.banned ? styles.tagDanger : styles.tag}>
                  {a.banned ? t.banned(a.banUntil ? modDate(a.banUntil) : undefined) : t.notBanned}
                </span>
              </span>
              {a.banReason && <span className="muted">{t.banReason(a.banReason)}</span>}
              <p className={styles.quote}>{a.body}</p>
              <span className="muted">{t.received(modDate(a.createdAt))}</span>
              {a.status !== 'open' && (
                <span className="muted">
                  {t.decided(
                    t.states[a.status],
                    a.decidedByName ?? '–',
                    a.decidedAt ? modDate(a.decidedAt) : '',
                  )}
                  {a.decisionNote && ` · ${t.note(a.decisionNote)}`}
                </span>
              )}
              <span className={styles.links}>
                <Link to={adminUser(a.userId)}>{t.openUser}</Link>
              </span>
              {a.status === 'open' && (
                <div className={styles.buttons}>
                  <Button variant="secondary" onClick={() => setDecide({ appeal: a, accept: true })}>
                    {t.accept}
                  </Button>
                  <Button variant="danger" onClick={() => setDecide({ appeal: a, accept: false })}>
                    {t.reject}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!decide} title={decide?.accept ? t.acceptTitle : t.rejectTitle} onClose={close}>
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          <p>{decide?.accept ? t.acceptText : t.rejectText}</p>
          <TextArea
            label={needsNote ? t.rejectNote : t.acceptNote}
            value={note}
            rows={3}
            maxLength={1000}
            required={needsNote}
            onChange={(e) => setNote(e.target.value)}
          />
          {actionError && <Notice tone="error">{actionError}</Notice>}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={close}>
              {de.modAdmin.cancel}
            </Button>
            <Button
              type="submit"
              variant={decide?.accept ? 'primary' : 'danger'}
              disabled={busy || (needsNote && !note.trim())}
            >
              {de.modAdmin.confirm}
            </Button>
          </div>
        </form>
      </Sheet>
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

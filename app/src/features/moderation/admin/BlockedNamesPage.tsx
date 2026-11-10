// Admin → Verwaltung → Gesperrte Nutzernamen (Wunsch Nutzer 2026-11-10): Wörter, die neue Konten nicht im Namen
// tragen dürfen. Der Server prüft beim Anlegen selbst (Trigger profiles_username_guard); bestehende Konten bleiben.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { SelectField, TextField } from '../../../design/components/Field';
import { Notice } from '../../../design/components/Notice';
import { Sheet } from '../../../design/components/Sheet';
import { Toast } from '../../../design/components/Toast';
import {
  blockedPatternIssue,
  usernameKey,
  type BlockedName,
  type BlockedNameKind,
} from '../../../domain/modTools';
import { useProviders } from '../../../ports/providersContext';
import { ADMIN_BASE } from './adminPaths';
import { modDate, modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.blockedNames;
const KINDS = [
  { value: 'contains', label: t.kinds.contains },
  { value: 'exact', label: t.kinds.exact },
] as const satisfies readonly { value: BlockedNameKind; label: string }[];

export function BlockedNamesPage() {
  const { account } = useProviders();
  const [list, setList] = useState<BlockedName[]>();
  const [error, setError] = useState<string>();
  const [pattern, setPattern] = useState('');
  const [kind, setKind] = useState<BlockedNameKind>('contains');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<BlockedName>();
  const [toast, setToast] = useState<string>();

  const load = useCallback(async () => {
    try {
      setList(await account.modBlockedNames());
      setError(undefined);
    } catch (e) {
      setError(modErrorText(e));
    }
  }, [account]);

  useEffect(() => {
    // erst nach dem Zeichnen laden (Zustand wird nur asynchron gesetzt)
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const issue = pattern.trim() ? blockedPatternIssue(pattern) : undefined;
  const key = usernameKey(pattern);
  const duplicate = !!list?.some((b) => b.pattern === key);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (issue || duplicate || !key) return;
    setBusy(true);
    setFormError(undefined);
    try {
      await account.modAddBlockedName(key, kind, note.trim() || undefined);
      setPattern('');
      setNote('');
      setToast(t.added);
      await load();
    } catch (err) {
      setFormError(modErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await account.modRemoveBlockedName(remove.pattern);
      setRemove(undefined);
      setToast(t.removed);
      await load();
    } catch (err) {
      setFormError(modErrorText(err));
      setRemove(undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.title} back={`${ADMIN_BASE}/verwaltung`}>
      <p className="muted">{t.intro}</p>
      <Section title={t.addTitle}>
        <form className={styles.form} onSubmit={(e) => void add(e)}>
          <TextField
            label={t.pattern}
            hint={t.patternHint}
            value={pattern}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            error={issue ? t.issues[issue] : duplicate ? t.issues.exists : undefined}
            onChange={(e) => setPattern(e.target.value)}
          />
          <SelectField
            label={t.kind}
            value={kind}
            options={KINDS}
            onChange={(e) => setKind(e.target.value as BlockedNameKind)}
          />
          <TextField label={t.note} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          {formError && <Notice tone="error">{formError}</Notice>}
          <div className={styles.buttons}>
            <Button type="submit" disabled={busy || !key || !!issue || duplicate}>
              {t.add}
            </Button>
          </div>
        </form>
      </Section>
      <Section title={t.title}>
        {error && <Notice tone="error">{error}</Notice>}
        {!list && !error && <p className="muted">{de.modAdmin.loading}</p>}
        {list?.length === 0 && <p className="muted">{t.empty}</p>}
        {list && list.length > 0 && (
          <ul className={styles.list}>
            {list.map((b) => (
              <li key={b.pattern} className={styles.item}>
                <span className={styles.row}>
                  <strong>{b.pattern}</strong>
                  <span className={styles.tag}>{t.kindsShort[b.kind]}</span>
                </span>
                {b.note && <span>{b.note}</span>}
                <span className="muted">
                  {t.matches(b.matches)}
                  {b.moderatorName && ` · ${t.by(b.moderatorName, modDate(b.createdAt))}`}
                </span>
                <div className={styles.buttons}>
                  <Button variant="ghost" onClick={() => setRemove(b)}>
                    {t.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Sheet
        open={!!remove}
        title={remove ? t.removeTitle(remove.pattern) : ''}
        onClose={() => setRemove(undefined)}
      >
        <div className={styles.form}>
          <p>{t.removeText}</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setRemove(undefined)}>
              {de.modAdmin.cancel}
            </Button>
            <Button disabled={busy} onClick={() => void confirmRemove()}>
              {de.modAdmin.confirm}
            </Button>
          </div>
        </div>
      </Sheet>
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

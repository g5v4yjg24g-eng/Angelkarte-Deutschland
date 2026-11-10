// Einspruch gegen eine Sperre (Entscheidung Nutzer 2026-11-10): öffentliche Seite /einspruch?t=<Schlüssel> aus der
// Sperr-Mail. Ohne Anmeldung (gesperrte Konten können sich nicht anmelden); der Server prüft den Schlüssel selbst und
// nimmt je Sperre genau einen Einspruch an. Ohne gültigen Schlüssel in der Adresse wird nichts angefragt.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { TextArea } from '../../design/components/Field';
import { Notice } from '../../design/components/Notice';
import {
  APPEAL_MAX,
  appealBodyIssue,
  appealErrorKind,
  appealToken,
  type AppealInfo,
} from '../../domain/appeals';
import { useProviders } from '../../ports/providersContext';
import styles from './Moderation.module.css';

const t = de.appeal;
const day = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' });

export function AppealPage() {
  const { account } = useProviders();
  const { search } = useLocation();
  const token = appealToken(search);
  const [info, setInfo] = useState<AppealInfo | undefined>(token ? undefined : { state: 'invalid' });
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token || !account.enabled) return;
    let live = true;
    account
      .appealInfo(token)
      .then((i) => live && setInfo(i))
      .catch((e: unknown) => live && setError(t.errors[appealErrorKind(e as Error)]));
    return () => {
      live = false;
    };
  }, [account, token]);

  const issue = body ? appealBodyIssue(body) : 'short';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || issue) return;
    setBusy(true);
    setError(undefined);
    try {
      await account.submitAppeal(token, body.trim());
      setSent(true);
    } catch (err) {
      setError(t.errors[appealErrorKind(err as Error)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.title}>
      {!info && !error && <p className="muted">{t.loading}</p>}
      {error && !info && <Notice tone="error">{error}</Notice>}
      {sent && <Notice tone="success">{t.sent}</Notice>}
      {!sent && info?.state === 'invalid' && <Notice>{t.invalid}</Notice>}
      {!sent && info?.state === 'ended' && <Notice>{t.ended}</Notice>}
      {!sent && info?.state === 'used' && (
        <Notice>
          {t.used} {info.appealStatus && t.usedStatus[info.appealStatus]}
        </Notice>
      )}
      {!sent && info?.state === 'open' && (
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          <p>{t.intro}</p>
          <div className={styles.changed}>
            <strong>{info.banUntil ? t.until(day(info.banUntil)) : t.forever}</strong>
            {info.banReason && <p>{t.reason(info.banReason)}</p>}
          </div>
          <TextArea
            label={t.label}
            hint={t.hint(body.trim().length)}
            value={body}
            rows={6}
            maxLength={APPEAL_MAX}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <div className={styles.actions}>
            <Button type="submit" disabled={busy || !!issue}>
              {busy ? t.sending : t.send}
            </Button>
          </div>
          <p className={`muted ${styles.small}`}>{t.privacy}</p>
        </form>
      )}
      <p>
        <Link to="/">{t.toApp}</Link>
      </p>
    </Page>
  );
}

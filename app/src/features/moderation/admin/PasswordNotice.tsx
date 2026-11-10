// Moderation: einmalige Hinweis-Mail „Anmeldung jetzt mit Passwort“ an Konten aus der Code-Zeit
// (Wunsch Nutzer 2026-11-10). Erst zählen, dann mit Rückfrage senden; doppelt bekommt sie niemand.
import { useState } from 'react';
import { de } from '../../../i18n/de';
import { Button } from '../../../design/components/Button';
import { Notice } from '../../../design/components/Notice';
import { useProviders } from '../../../ports/providersContext';
import { modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.notice;

export function PasswordNotice() {
  const { account } = useProviders();
  const [pending, setPending] = useState<number>();
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const run = (send: boolean) => {
    if (send && !window.confirm(t.confirm)) return;
    setBusy(true);
    setError(undefined);
    account
      .modPasswordNotice(send)
      .then((r) => {
        setPending(r.pending);
        if (send) setResult(t.sent(r.sent, r.failed));
      })
      .catch((e: unknown) => setError(modErrorText(e)))
      .finally(() => setBusy(false));
  };

  return (
    <section className={styles.notice} aria-labelledby="mod-notice">
      <h2 id="mod-notice" className={styles.noticeTitle}>
        {t.title}
      </h2>
      <p className="muted">{t.text}</p>
      {pending !== undefined && <p role="status">{t.pending(pending)}</p>}
      {result && <p role="status">{result}</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.noticeActions}>
        <Button variant="secondary" disabled={busy} onClick={() => run(false)}>
          {t.check}
        </Button>
        {!!pending && (
          <Button disabled={busy} onClick={() => run(true)}>
            {t.send(pending)}
          </Button>
        )}
      </div>
    </section>
  );
}

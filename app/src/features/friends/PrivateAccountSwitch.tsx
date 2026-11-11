// „Privates Konto“ (Paket C, Entscheidung Nutzer 2026-11-10: selbst wählbar, Standard an). Gespeichert wird sofort
// auf dem Server; beim Ausschalten bestätigt der Server offene Anfragen. Bei Fehler springt der Schalter zurück.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { useProviders } from '../../ports/providersContext';
import styles from './Friends.module.css';

const t = de.friends;

export function PrivateAccountSwitch({ onChange }: { onChange?: () => void }) {
  const { account } = useProviders();
  const [value, setValue] = useState<boolean>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    account
      .accountPrivate()
      .then((v) => live && setValue(v))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [account]);

  if (value === undefined) return null;
  const change = async (v: boolean) => {
    setBusy(true);
    setError(undefined);
    setValue(v);
    try {
      await account.setAccountPrivate(v);
      onChange?.();
    } catch {
      setValue(!v);
      setError(t.privateError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={t.privateTitle}>
      <label className={styles.switchRow}>
        <input
          type="checkbox"
          checked={value}
          disabled={busy}
          onChange={(e) => void change(e.target.checked)}
        />
        <span>{t.privateLabel}</span>
      </label>
      <p className="muted">
        {value ? t.privateOn : t.privateOff}
        {value && ` ${t.privateOffNote}`}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
    </Section>
  );
}

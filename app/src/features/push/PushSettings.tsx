// Einstellungen → Mitteilungen (nur in der iPhone-App): Erlaubnis und jede Art einzeln (Wunsch Nutzer 2026-11-04).
// Die Auswahl liegt auf dem Server, weil dort entschieden wird, ob eine Mitteilung verschickt wird.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { PUSH_KINDS, type PushPermission, type PushPrefs } from '../../domain/push';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { registerDevice } from './pushDevice';
import styles from './Push.module.css';

const t = de.push;

export function PushSettings() {
  const { push, account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const [permission, setPermission] = useState<PushPermission>();
  const [prefs, setPrefs] = useState<PushPrefs>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!push.available) return;
    let live = true;
    void push.permission().then((p) => live && setPermission(p));
    if (signedIn)
      account
        .pushPrefs()
        .then((p) => live && setPrefs(p))
        .catch(() => live && setError(t.loadError));
    return () => {
      live = false;
    };
  }, [push, account, signedIn]);

  if (!push.available) return null;

  const allow = async () => {
    setError(undefined);
    const p = await push.requestPermission();
    setPermission(p);
    if (p === 'granted') await registerDevice(push, account).catch(() => setError(t.registerError));
  };

  const toggle = (kind: (typeof PUSH_KINDS)[number], on: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [kind]: on };
    setPrefs(next);
    setError(undefined);
    account.setPushPrefs(next).catch(() => {
      setPrefs(prefs);
      setError(t.saveError);
    });
  };

  return (
    <Section title={t.title}>
      {!signedIn ? (
        <p className="muted">{t.signedOut}</p>
      ) : (
        <>
          <p className="muted">{t.intro}</p>
          {permission === 'prompt' && (
            <div>
              <Button onClick={() => void allow()}>{t.allow}</Button>
            </div>
          )}
          {permission === 'denied' && <Notice>{t.denied}</Notice>}
          {prefs && (
            <fieldset className={styles.kinds} disabled={permission !== 'granted'}>
              <legend className="visually-hidden">{t.title}</legend>
              {PUSH_KINDS.map((k) => (
                <label key={k} className={styles.kind}>
                  <input type="checkbox" checked={prefs[k]} onChange={(e) => toggle(k, e.target.checked)} />
                  <span>{t.kinds[k]}</span>
                </label>
              ))}
            </fieldset>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <p className="muted">{t.note}</p>
        </>
      )}
    </Section>
  );
}

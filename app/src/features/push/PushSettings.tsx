// Einstellungen → Mitteilungen (nur in der iPhone-App): Erlaubnis und jede Art einzeln (Wunsch Nutzer 2026-11-04).
// Die Auswahl liegt auf dem Server, weil dort entschieden wird, ob eine Mitteilung verschickt wird.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import {
  PUSH_KINDS,
  pushTestState,
  type PushPermission,
  type PushPrefs,
  type PushStatus,
} from '../../domain/push';
import { AccountError } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { lastPushRegisterError, registerDevice } from './pushDevice';
import styles from './Push.module.css';

const t = de.push;

export function PushSettings() {
  const { push, account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const [permission, setPermission] = useState<PushPermission>();
  const [prefs, setPrefs] = useState<PushPrefs>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<PushStatus>();
  const [testMsg, setTestMsg] = useState<string>();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!push.available) return;
    let live = true;
    void push.permission().then((p) => live && setPermission(p));
    if (signedIn) {
      account
        .pushPrefs()
        .then((p) => live && setPrefs(p))
        .catch(() => live && setError(t.loadError));
      account
        .pushStatus()
        .then((s) => live && setStatus(s))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [push, account, signedIn]);

  if (!push.available) return null;

  const allow = async () => {
    setError(undefined);
    const p = await push.requestPermission();
    setPermission(p);
    if (p === 'granted')
      await registerDevice(push, account)
        .then(() => account.pushStatus().then(setStatus))
        .catch((e: unknown) => setError(t.registerFailed(e instanceof Error ? e.message : String(e))));
  };

  // Test an sich selbst: zeigt, ob das iPhone angemeldet ist und ob Apple die Mitteilung annimmt
  const sendTest = async () => {
    setTesting(true);
    setTestMsg(undefined);
    try {
      let n = await account.sendTestPush();
      if (n === 0 && permission === 'granted') {
        try {
          await registerDevice(push, account);
        } catch (e) {
          setStatus({ devices: 0 });
          setTestMsg(t.registerFailed(e instanceof Error ? e.message : String(e)));
          return;
        }
        n = await account.sendTestPush();
      }
      if (n === 0) {
        setStatus({ devices: 0 });
        setTestMsg(t.deviceMissing);
        return;
      }
      setTestMsg(t.testWaiting);
      await new Promise((r) => setTimeout(r, 4000));
      const s = await account.pushStatus();
      setStatus(s);
      const state = pushTestState(s);
      setTestMsg(
        state === 'sent' ? t.testSent : state === 'error' ? t.testError(s.test?.error ?? '') : t.testStuck,
      );
    } catch (e) {
      setTestMsg(e instanceof AccountError && /too_many_tests/.test(e.message) ? t.testLimit : t.saveError);
    } finally {
      setTesting(false);
    }
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
          {permission === 'granted' && (
            <div className={styles.test}>
              {status && <p className="muted">{status.devices > 0 ? t.deviceOk : t.deviceMissing}</p>}
              {status?.devices === 0 && lastPushRegisterError() && (
                <p className="muted">{t.registerFailed(lastPushRegisterError() ?? '')}</p>
              )}
              <div>
                <Button variant="secondary" disabled={testing} onClick={() => void sendTest()}>
                  {t.test}
                </Button>
              </div>
              {testMsg && <p role="status">{testMsg}</p>}
            </div>
          )}
          <p className="muted">{t.note}</p>
        </>
      )}
    </Section>
  );
}

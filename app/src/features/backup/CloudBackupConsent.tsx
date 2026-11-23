// Einmalige Zustimmung zur Cloud-Sicherung (Entscheidung Nutzer 2026-11-23: Standard an, aber erst nach klarer
// Zustimmung). Erscheint für angemeldete Konten nach dem Intro, nicht beim Hochladen und nicht in automatisierten
// Tests (außer ausdrücklich eingeschaltet). „Nicht jetzt“ merkt sich die Entscheidung; einschalten geht später unter
// Mehr → Daten & Sicherung.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { useProviders } from '../../ports/providersContext';
import { getSetting } from '../../data/settings';
import { declineCloudBackup, setCloudBackupEnabled } from '../../data/cloudBackupService';
import { shouldAskCloudConsent } from '../../domain/cloudBackup';
import { afterIntro } from '../../lib/afterIntro';
import { usePromptsBlocked } from '../trips/promptBlock';
import { useStoredUserId } from '../badges/badgeStore';
import styles from '../whatsNew/WhatsNew.module.css';

const TEST_FLAG = 'fangpunkt.e2e.cloudBackup';

function testsAllowed(): boolean {
  if (!navigator.webdriver) return true;
  try {
    return localStorage.getItem(TEST_FLAG) === '1';
  } catch {
    return false;
  }
}

const t = de.cloudBackup;

export function CloudBackupConsent() {
  const { account } = useProviders();
  const stored = useStoredUserId();
  const userId = account.enabled ? stored : undefined;
  const all = useLiveQuery(async () => ({ map: await getSetting('cloudBackup') }), []);
  const blocked = usePromptsBlocked();
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const ask = !!userId && all !== undefined && shouldAskCloudConsent(all.map?.[userId]);

  const allowed = testsAllowed();
  useEffect(() => {
    if (!ask || !allowed) return;
    return afterIntro(() => setReady(true));
  }, [ask, allowed]);

  const open = ask && allowed && ready && !blocked;
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  if (!open || !userId) return null;
  const no = () => void declineCloudBackup(userId);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="cloud-consent-title"
      onCancel={(e) => {
        e.preventDefault();
        no();
      }}
    >
      <h2 id="cloud-consent-title" className={styles.title}>
        {t.consentTitle}
      </h2>
      <div className={styles.body}>
        <p>{t.consentIntro}</p>
        <ul className={styles.list}>
          {t.consentItems.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
        <p>
          <Link to="/mehr/datenschutz" onClick={no}>
            {t.consentMore}
          </Link>
        </p>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={no}>
          {t.consentNo}
        </Button>
        <Button onClick={() => void setCloudBackupEnabled(userId, true)} autoFocus>
          {t.consentYes}
        </Button>
      </div>
    </dialog>
  );
}

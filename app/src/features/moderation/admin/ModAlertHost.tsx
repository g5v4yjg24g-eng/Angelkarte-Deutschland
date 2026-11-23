// Pop-up für Moderatoren bei neuen Meldungen (Wunsch Nutzer 2026-11-23, Entwurf A + C): ein dunkles Band mit
// Warnstreifen oben, bei einer Meldung, die länger als 20 Stunden offen ist, das Vollbild. Nur für Moderatoren;
// gezeigt werden Art und Grund, nie Inhalt oder meldende Person. Läuft im RootLayout (auch im Admin-Bereich),
// fragt alle 60 s und beim Zurückkehren in die App nach, solange sie sichtbar ist.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { de } from '../../../i18n/de';
import {
  ALERT_POLL_MS,
  decideAlert,
  dismissBand,
  hoursOpen,
  oldestAgeMs,
  parseAlertState,
  snoozeFull,
  type AlertState,
  type AlertView,
} from '../../../domain/modAlerts';
import { useProviders } from '../../../ports/providersContext';
import { useNow } from '../../../lib/useNow';
import { useOnline } from '../../../lib/useOnline';
import { storedUserId } from '../../badges/badgeStore';
import { usePromptsBlocked } from '../../trips/promptBlock';
import { ADMIN_BASE } from './adminPaths';
import { useIsModerator } from './useIsModerator';
import styles from './ModAlert.module.css';

const t = de.modAlert;
const key = (uid: string) => `fangpunkt.modAlert.${uid}`;
const read = (uid: string): AlertState => {
  try {
    return parseAlertState(localStorage.getItem(key(uid)));
  } catch {
    return {};
  }
};
const write = (uid: string, s: AlertState) => {
  try {
    localStorage.setItem(key(uid), JSON.stringify(s));
  } catch {
    /* ohne Speicher erscheint das Band beim nächsten Start noch einmal */
  }
};

const kindLabel = (k?: string) => de.modAdmin.kinds[k as keyof typeof de.modAdmin.kinds] ?? 'Meldung';
const reasonLabel = (r?: string) =>
  de.moderation.reasons[r as keyof typeof de.moderation.reasons] ?? 'Sonstiges';

function WarnIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v5" />
      <path d="M12 18v.01" />
    </svg>
  );
}

function Full({
  view,
  onOpen,
  onLater,
}: {
  view: NonNullable<AlertView>;
  onOpen: () => void;
  onLater: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  const now = useNow(60_000);
  const age = oldestAgeMs(view.summary, now);
  return (
    <dialog
      ref={ref}
      className={styles.full}
      aria-labelledby="mod-alert-title"
      onCancel={(e) => {
        e.preventDefault();
        onLater();
      }}
    >
      <div className={styles.rings} aria-hidden="true">
        <i />
        <i />
        <i />
        <div className={styles.core}>
          <WarnIcon />
        </div>
      </div>
      <p className={styles.count}>{t.fullCount(view.summary.openCount)}</p>
      <h2 id="mod-alert-title" className={styles.fullTitle}>
        {t.fullTitle}
      </h2>
      {age !== undefined && <p className={styles.fullSub}>{t.fullAge(hoursOpen(age))}</p>}
      <div className={styles.fullActions}>
        <button type="button" className={styles.primary} onClick={onOpen}>
          {t.fullOpen}
        </button>
        <button type="button" className={styles.secondary} onClick={onLater}>
          {t.fullLater}
        </button>
      </div>
    </dialog>
  );
}

export function ModAlertHost() {
  const { account } = useProviders();
  const moderator = useIsModerator();
  const online = useOnline();
  const blocked = usePromptsBlocked();
  const navigate = useNavigate();
  const location = useLocation();
  const uid = account.enabled ? storedUserId() : undefined;
  const [view, setView] = useState<AlertView>();
  const stateRef = useRef<AlertState>({});

  const check = useCallback(async () => {
    if (!uid || document.visibilityState !== 'visible') return;
    try {
      const summary = await account.modAlertSummary();
      stateRef.current = read(uid);
      setView(decideAlert(summary, stateRef.current, Date.now()));
    } catch {
      /* ohne Verbindung: kein Pop-up */
    }
  }, [account, uid]);

  useEffect(() => {
    if (!uid || moderator !== true || !online) return;
    void check();
    const timer = window.setInterval(() => void check(), ALERT_POLL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [uid, moderator, online, check]);

  // Wer schon in der Meldungsliste ist, braucht kein Pop-up
  const inReports = location.pathname.startsWith(`${ADMIN_BASE}/meldungen`);
  if (!uid || moderator !== true || !view || blocked || inReports) return null;

  const later = () => {
    const next =
      view.kind === 'full'
        ? snoozeFull(view.summary, stateRef.current, Date.now())
        : dismissBand(view.summary, stateRef.current);
    write(uid, next);
    stateRef.current = next;
    setView(undefined);
  };
  const open = () => {
    write(uid, dismissBand(view.summary, stateRef.current));
    setView(undefined);
    navigate(`${ADMIN_BASE}/meldungen`);
  };

  if (view.kind === 'full') return <Full view={view} onOpen={open} onLater={later} />;
  const s = view.summary;
  return (
    <div className={styles.band} role="alert">
      <div className={styles.stripe} aria-hidden="true" />
      <div className={styles.body}>
        <div className={styles.dot} aria-hidden="true">
          !
        </div>
        <div className={styles.text}>
          <p className={styles.title}>{t.bandTitle}</p>
          <p className={styles.sub}>
            {t.bandSub(kindLabel(s.newestType), reasonLabel(s.newestReason))}
            {s.openCount > 1 ? ` · ${t.more(s.openCount)}` : ''}
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={open}>
            {t.open}
          </button>
          <button type="button" className={styles.secondary} onClick={later}>
            {t.later}
          </button>
        </div>
      </div>
    </div>
  );
}

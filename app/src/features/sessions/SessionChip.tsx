// Laufende Session in der Kopfzeile, auf jeder Seite sichtbar; Antippen öffnet sie.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { durationMs, formatDuration, looksForgotten } from '../../domain/session';
import { useNow } from '../../lib/useNow';
import { useRunningSession } from './useSessions';
import styles from './Sessions.module.css';

const t = de.sessions;

export function SessionChip() {
  const s = useRunningSession();
  const now = useNow();
  if (!s) return null;
  const duration = formatDuration(durationMs(s, now));
  const forgotten = looksForgotten(s, now);
  return (
    <Link
      to={`/fangbuch/sessions/${s.id}`}
      className={[styles.chip, forgotten ? styles.chipWarn : ''].join(' ')}
      aria-label={forgotten ? t.forgottenTitle : t.chipLabel(duration)}
    >
      <span className={styles.dot} aria-hidden="true" />
      {forgotten ? (
        t.forgottenChip
      ) : (
        <>
          <span className={styles.chipPrefix}>{t.chipPrefix}</span>
          {duration}
        </>
      )}
    </Link>
  );
}

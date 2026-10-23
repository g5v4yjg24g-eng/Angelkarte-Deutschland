// Laufende Session in der Kopfzeile, auf jeder Seite sichtbar; Antippen öffnet sie.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { durationMs, formatDuration, looksForgotten, openPause } from '../../domain/session';
import { useNow } from '../../lib/useNow';
import { useRunningSession } from './useSessions';
import { useTrackStatus } from './tracking/trackStatus';
import styles from './Sessions.module.css';

const t = de.sessions;

export function SessionChip() {
  const s = useRunningSession();
  const now = useNow();
  const track = useTrackStatus();
  if (!s) return null;
  const gps = track.state === 'recording';
  const duration = formatDuration(durationMs(s, now));
  const forgotten = looksForgotten(s, now);
  const paused = !!openPause(s);
  return (
    <Link
      to={`/fangbuch/sessions/${s.id}`}
      className={[styles.chip, forgotten ? styles.chipWarn : '', paused ? styles.chipPaused : ''].join(' ')}
      aria-label={
        (forgotten ? t.forgottenTitle : paused ? t.chipPausedLabel(duration) : t.chipLabel(duration)) +
        (gps ? ` · ${de.tracking.chipLabel}` : '')
      }
    >
      <span className={styles.dot} aria-hidden="true" />
      {forgotten ? (
        t.forgottenChip
      ) : (
        <>
          <span className={styles.chipPrefix}>{paused ? t.chipPaused : t.chipPrefix}</span>
          {duration}
          {gps && (
            <span className={styles.gpsMark} aria-hidden="true">
              GPS
            </span>
          )}
        </>
      )}
    </Link>
  );
}

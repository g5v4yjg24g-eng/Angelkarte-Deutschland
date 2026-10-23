// Zeigt in der laufenden Session, ob GPS aktiv ist und die Route aufgezeichnet wird.
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../../i18n/de';
import { Notice } from '../../../design/components/Notice';
import { Button } from '../../../design/components/Button';
import { getTrack } from '../../../data/trackService';
import { pointCount, trackDistanceM } from '../../../domain/track';
import { retryTracking, useTrackStatus } from './trackStatus';
import styles from '../Sessions.module.css';

const t = de.tracking;

export function TrackingStatus({ sessionId }: { sessionId: string }) {
  const status = useTrackStatus();
  const track = useLiveQuery(() => getTrack(sessionId), [sessionId]);
  if (status.state === 'idle') return null;
  const tone =
    status.state === 'denied' || status.state === 'unavailable'
      ? 'warning'
      : status.state === 'recording'
        ? 'success'
        : 'info';
  const points = track ? pointCount(track.segments) : 0;
  return (
    <section className={styles.stack} aria-label={t.title} data-track-state={status.state}>
      <Notice tone={tone}>
        <div className={styles.stack}>
          <p>
            <strong>{t.title}:</strong> {t.states[status.state]}
          </p>
          {points > 0 && (
            <p className="tabular">
              {t.progress(
                points,
                (trackDistanceM(track?.segments ?? []) / 1000).toLocaleString('de-DE', {
                  maximumFractionDigits: 2,
                }),
              )}
            </p>
          )}
          {status.weak && status.state !== 'denied' && <p>{t.weak}</p>}
          {(status.state === 'denied' || status.state === 'unavailable') && (
            <div>
              <Button variant="secondary" onClick={retryTracking}>
                {t.retry}
              </Button>
            </div>
          )}
          {status.state === 'off' && (
            <div>
              <Link to="/mehr/einstellungen">{t.enable}</Link>
            </div>
          )}
        </div>
      </Notice>
      <p className="muted">{t.foreground}</p>
    </section>
  );
}

// Route (GPS) in der Session-Ansicht (Vorlage Nutzer 2026-11-11): Schalter „Route aufzeichnen“, Stand, Punkte und
// Kilometer als Link zum Rückblick. Nach dem Ende nur noch Punkte und Kilometer, wenn eine Route da ist.
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Switch } from '../../design/components/Switch';
import { ChevronRightIcon, DistanceIcon, PathIcon, PinIcon } from '../../design/icons';
import { setSetting } from '../../data/settings';
import { getTrack } from '../../data/trackService';
import { pointCount, trackDistanceM } from '../../domain/track';
import type { Session } from '../../domain/schemas';
import { isRunning } from '../../domain/session';
import { useProviders } from '../../ports/providersContext';
import { useBoolSetting } from '../settings/useBoolSetting';
import { retryTracking, useTrackStatus } from './tracking/trackStatus';
import styles from './Sessions.module.css';

const t = de.tracking;
const ts = de.sessions;

export function RouteCard({ session }: { session: Session }) {
  const status = useTrackStatus();
  const { route } = useProviders();
  const enabled = useBoolSetting('trackSessions', true);
  const track = useLiveQuery(() => getTrack(session.id), [session.id]);
  const running = isRunning(session);
  const points = track ? pointCount(track.segments) : 0;
  const km = (trackDistanceM(track?.segments ?? []) / 1000).toLocaleString('de-DE', {
    maximumFractionDigits: 2,
  });
  if (!running && points === 0) return null;
  const state = status.state;
  const problem = state === 'denied' || state === 'unavailable';
  return (
    <section className={styles.card} aria-label={t.title} {...(running ? { 'data-track-state': state } : {})}>
      {running && (
        <div className={styles.cardRow}>
          <span className={styles.cardIcon}>
            <PinIcon size={24} />
          </span>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>{ts.routeTitle}</span>
            <span className={styles.rowHint}>{t.hint[state]}</span>
          </span>
          <Switch
            label={ts.routeSwitch}
            checked={enabled ?? true}
            disabled={enabled === undefined}
            onChange={(next) => void setSetting('trackSessions', next)}
          />
        </div>
      )}
      {points > 0 && (
        <Link
          to={`/fangbuch/sessions/${session.id}/rueckblick`}
          className={`${styles.cardRow} ${styles.statRow}`}
          aria-label={`${ts.routeOpen}: ${ts.routePoints(points)}, ${ts.routeKm(km)}`}
        >
          <span className={styles.stat}>
            <PathIcon size={20} />
            {ts.routePoints(points)}
          </span>
          <span className={styles.stat}>
            <DistanceIcon size={20} />
            {ts.routeKm(km)}
          </span>
          <ChevronRightIcon className={styles.chevron ?? ''} size={20} />
        </Link>
      )}
      {running && problem && (
        <div className={styles.cardBody}>
          <Notice tone="warning">{t.states[state]}</Notice>
          <div>
            <Button variant="secondary" onClick={retryTracking}>
              {t.retry}
            </Button>
          </div>
        </div>
      )}
      {running && status.weak && !problem && <p className={`muted ${styles.cardBody}`}>{t.weak}</p>}
      {running && (
        <details className={styles.cardBody}>
          <summary>{t.noteSummary}</summary>
          <p className="muted">{route ? t.background : t.foreground}</p>
        </details>
      )}
    </section>
  );
}

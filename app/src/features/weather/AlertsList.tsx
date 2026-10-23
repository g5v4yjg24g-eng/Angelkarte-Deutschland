// Amtliche Warnungen des DWD (Freigabe Quelle Bright Sky 2026-10-23): Stufe, Zeitraum, Text und Hinweise.
// Höchste Stufe zuerst; abgelaufene Warnungen werden nicht gezeigt.
import { useMemo } from 'react';
import { de } from '../../i18n/de';
import { alertsBetween, alertsQuery, type Alert } from '../../domain/alerts';
import { useAlerts } from './useAlerts';
import styles from './Alerts.module.css';

const t = de.alerts;
const when = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });

export function AlertItem({ a, compact = false }: { a: Alert; compact?: boolean }) {
  return (
    <li className={[styles.alert, styles[a.severity]].join(' ')}>
      <p className={styles.level}>{t.levels[a.severity]}</p>
      <p className={styles.headline}>{a.headline}</p>
      <p className="muted">{t.period(when(a.from), a.to && when(a.to))}</p>
      {!compact && (a.description || a.instruction) && (
        <details className={styles.details}>
          <summary>{t.details}</summary>
          {a.description && <p>{a.description}</p>}
          {a.instruction && <p className={styles.instruction}>{a.instruction}</p>}
        </details>
      )}
    </li>
  );
}

export function AlertsList({ alerts, compact }: { alerts: Alert[]; compact?: boolean }) {
  return (
    <ul className={styles.list}>
      {alerts.map((a) => (
        <AlertItem key={a.id} a={a} {...(compact ? { compact } : {})} />
      ))}
    </ul>
  );
}

const stamp = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });

/** Abschnitt auf der Wetter-Seite: Warnungen ab jetzt für den gewählten Ort. */
export function WeatherAlerts({ lat, lng, nowMs }: { lat: number; lng: number; nowMs: number }) {
  const q = useMemo(() => alertsQuery({ lat, lng }), [lat, lng]);
  const { state } = useAlerts(q);
  const data = state.status === 'ok' ? state.data : state.status === 'loading' ? state.cached : undefined;
  const list = data ? alertsBetween(data.alerts, nowMs, Infinity) : [];
  return (
    <section className={styles.section} aria-labelledby="alerts-title">
      <h2 id="alerts-title" className={styles.title}>
        {t.title}
        {data?.place && <span className={styles.place}> {t.for(data.place)}</span>}
      </h2>
      {!data ? (
        <p className="muted">{state.status === 'error' ? t.error : t.loading}</p>
      ) : (
        <>
          {state.status === 'ok' && state.stale && <p className="muted">{t.stale(stamp(data.fetchedAt))}</p>}
          {list.length === 0 ? (
            <p className={styles.none}>{t.none(data.place)}</p>
          ) : (
            <AlertsList alerts={list} />
          )}
          <p className={styles.source}>{t.source}</p>
        </>
      )}
    </section>
  );
}

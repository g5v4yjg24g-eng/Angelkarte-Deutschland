// Pegel in der Nähe des gewählten Orts (Idee 1, Variante A): Wasserstand mit Lage zu MNW/MHW und 24-h-Änderung,
// Abfluss und Wassertemperatur, wo gemessen. Ehrlich, wenn kein Pegel in der Nähe ist.
import { de } from '../../i18n/de';
import { GAUGE_RADIUS_KM, seriesOf, type GaugeSeries, type GaugeStation } from '../../domain/gauges';
import { useGauge } from './useGauge';
import styles from './Alerts.module.css';
import w from './Weather.module.css';

const t = de.gauge;
const time = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('de-DE', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
      })
    : undefined;
const stamp = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });
const value = (s: GaugeSeries) => (s.value === undefined ? undefined : t.levelValue(s.value, s.unit));

function GaugeFacts({
  station,
  km,
  change24h,
}: {
  station: GaugeStation;
  km: number;
  change24h?: number | undefined;
}) {
  const level = seriesOf(station, 'W');
  const state = level?.state ? t.states[level.state] : '';
  return (
    <div className={w.nowCard}>
      <span className="muted">{t.station(station.name, station.water, km)}</span>
      <dl className={w.facts}>
        {level && level.value !== undefined && (
          <div>
            <dt>{t.level}</dt>
            <dd>
              {value(level)}
              {change24h !== undefined && ` · ${t.change(change24h, level.unit)}`}
              {state && <span className="muted"> · {state}</span>}
              <br />
              <small className="muted">
                {time(level.at) && `${t.measuredAt(time(level.at) ?? '')} · `}
                {t.levelNote}
              </small>
            </dd>
          </div>
        )}
        {(['Q', 'WT'] as const).map((k) => {
          const s = seriesOf(station, k);
          if (!s || s.value === undefined) return null;
          return (
            <div key={k}>
              <dt>{k === 'Q' ? t.flow : t.temp}</dt>
              <dd>
                {value(s)}
                {time(s.at) && <span className="muted"> · {t.measuredAt(time(s.at) ?? '')}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function GaugeCard({ lat, lng }: { lat: number; lng: number }) {
  const g = useGauge({ lat, lng });
  return (
    <section className={styles.section} aria-labelledby="gauge-title">
      <h2 id="gauge-title" className={styles.title}>
        {t.title}
      </h2>
      {g.status === 'loading' && <p className="muted">{t.loading}</p>}
      {g.status === 'error' && <p className="muted">{t.error}</p>}
      {g.status === 'ok' && (
        <>
          {g.stale && <p className="muted">{t.stale(stamp(g.fetchedAt))}</p>}
          {!g.nearest || g.nearest.km > GAUGE_RADIUS_KM ? (
            <>
              <p>{t.none(GAUGE_RADIUS_KM)}</p>
              {g.nearest && (
                <p className="muted">
                  {t.nearestFar(g.nearest.station.name, g.nearest.station.water, g.nearest.km)}
                </p>
              )}
              <p className="muted">{t.coverage}</p>
            </>
          ) : (
            <GaugeFacts station={g.nearest.station} km={g.nearest.km} change24h={g.change24h} />
          )}
          <p className={styles.source}>{t.source}</p>
        </>
      )}
    </section>
  );
}

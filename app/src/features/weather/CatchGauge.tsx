// Pegel am Fang: gespeicherter Wasserstand am nächsten Pegel zum Fangzeitpunkt oder der Grund, warum keiner da ist
// (Vorlage Nutzer 2026-11-12: Kachel mit Symbol, Überschrift und Erklärung).
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import type { Catch } from '../../domain/schemas';
import { formatDateTime } from '../../lib/storage';
import { GaugeIcon, WavesIcon } from '../../design/icons';
import { useWeatherEnabled } from './useWeatherEnabled';
import styles from './CatchWeather.module.css';

const t = de.catchGauge;
const g = de.gauge;

export function CatchGauge({ item }: { item: Catch }) {
  const enabled = useWeatherEnabled();
  const s = item.gauge;
  if (!item.position || (!s && enabled === undefined)) return null;
  const head = (
    <h3 className={styles.title}>
      <WavesIcon size={20} aria-hidden="true" /> {t.title}
    </h3>
  );
  return (
    <section className={styles.box} aria-label={t.title}>
      {head}
      {!s ? (
        <p className="muted">{enabled ? t.pending : <Link to="/mehr/einstellungen">{t.off}</Link>}</p>
      ) : s.status === 'none' ? (
        <div className={`${styles.tile} ${styles.row}`}>
          <GaugeIcon size={34} aria-hidden="true" />
          <div>
            <strong>{de.catchView.noMeasure}</strong>
            <small>{t.none[s.reason]}</small>
          </div>
        </div>
      ) : (
        <>
          <div className={`${styles.tile} ${styles.row}`}>
            <GaugeIcon size={34} aria-hidden="true" />
            <div>
              <span className={styles.label}>{g.level}</span>
              <strong>
                {g.levelValue(s.levelCm, 'cm')}
                {s.change24h !== undefined && ` · ${g.change(s.change24h, 'cm')}`}
                {s.state && g.states[s.state] && <span className="muted"> · {g.states[s.state]}</span>}
              </strong>
              <small>{t.station(s.name, s.water || s.area, s.km)}</small>
            </div>
          </div>
          <p className={styles.note}>
            <span>
              {t.measuredAt(formatDateTime(s.at))} · {g.levelNote} {t.source(s.attribution)}
            </span>
          </p>
        </>
      )}
    </section>
  );
}

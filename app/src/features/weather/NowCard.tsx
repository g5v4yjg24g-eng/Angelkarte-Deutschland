// „Jetzt“-Karte (Vorlage Nutzer 2026-11-12): links Temperatur, Symbol, Wetterlage und Höchst-/Tiefstwert, rechts
// Luftdruck mit Trend, Wind mit Böen und Luftfeuchte. Fehlende Werte fehlen einfach.
import { de } from '../../i18n/de';
import { compassIndex } from '../../domain/weather';
import type { DaySummary, ForecastHour } from '../../domain/forecast';
import type { WeatherIconKey } from '../../domain/forecastView';
import { DropIcon, GaugeIcon, WindIcon } from '../../design/icons';
import { WeatherIcon } from './WeatherIcon';
import styles from './WeatherView.module.css';

const t = de.forecast;
const w = de.weather;
const codeText = (c?: number) => (c === undefined ? '' : (w.codes[c] ?? w.codeUnknown(c)));
const one = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
/** ab dieser Änderung (hPa in 3 h) zeigt der Pfeil nach oben oder unten */
const TREND_HPA = 0.5;

function Trend({ change }: { change: number }) {
  const dir = change > TREND_HPA ? 'up' : change < -TREND_HPA ? 'down' : 'flat';
  const rotate = dir === 'up' ? -45 : dir === 'down' ? 45 : 0;
  return (
    <span
      className={styles.trend}
      title={dir === 'up' ? t.trendUp : dir === 'down' ? t.trendDown : t.trendFlat}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        <path
          d="M5 12h14m-5-5 5 5-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="visually-hidden">
        {dir === 'up' ? t.trendUp : dir === 'down' ? t.trendDown : t.trendFlat}
      </span>
    </span>
  );
}

export function NowCard({
  now,
  today,
  icon,
  change,
}: {
  now: ForecastHour | undefined;
  today: DaySummary | undefined;
  icon: WeatherIconKey | undefined;
  change: number | undefined;
}) {
  const compass = now?.windDirDeg === undefined ? undefined : w.compass[compassIndex(now.windDirDeg)];
  return (
    <section className={`${styles.card} ${styles.nowGrid}`} aria-label={t.now}>
      <div className={styles.nowMain}>
        <p className={styles.nowLabel}>{t.now}</p>
        <div className={styles.nowTempRow}>
          {now?.tempC !== undefined && <span className={styles.nowTemp}>{t.deg(now.tempC)}</span>}
          {icon && <WeatherIcon icon={icon} size={64} />}
        </div>
        <p className={styles.nowSky}>{codeText(now?.code)}</p>
        {today?.day.tMax !== undefined && today.day.tMin !== undefined && (
          <p className={styles.nowHiLo}>{t.hiLo(today.day.tMax, today.day.tMin)}</p>
        )}
      </div>
      <dl className={styles.nowMetrics}>
        {now?.pressureHpa !== undefined && (
          <div className={styles.metric}>
            <GaugeIcon size={26} />
            <dt>{t.pressure}</dt>
            <dd>
              <span className={styles.metricLine}>
                {Math.round(now.pressureHpa).toLocaleString('de-DE')} hPa
                {change !== undefined && <Trend change={change} />}
              </span>
            </dd>
          </div>
        )}
        {now?.windMs !== undefined && (
          <div className={styles.metric}>
            <WindIcon size={26} />
            <dt>{t.windLabel}</dt>
            <dd>
              {one(now.windMs)} m/s{compass && ` (${compass})`}
              {now.gustMs !== undefined && <small>{t.gustLabel(now.gustMs)}</small>}
            </dd>
          </div>
        )}
        {now?.humidityPct !== undefined && (
          <div className={styles.metric}>
            <DropIcon size={26} />
            <dt>{t.humidity}</dt>
            <dd>{t.humidityValue(now.humidityPct)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

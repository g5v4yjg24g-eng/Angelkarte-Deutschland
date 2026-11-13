// Wetter eines Fangs (Vorlage Nutzer 2026-11-12): große Kachel mit Wetterlage und Temperatur, daneben Wind, Luftdruck,
// Bewölkung, Niederschlag; gespeicherte Modellwerte oder der Grund, warum (noch) keine da sind.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import type { Catch } from '../../domain/schemas';
import { compassIndex, nearestHour, WEATHER_FROM } from '../../domain/weather';
import { weatherIcon } from '../../domain/forecastView';
import { formatDateTime } from '../../lib/storage';
import { CloudIcon, DropIcon, GaugeIcon, InfoIcon, WeatherIcon as SkyIcon, WindIcon } from '../../design/icons';
import { useWeatherEnabled } from './useWeatherEnabled';
import { WeatherIcon } from './WeatherIcon';
import styles from './CatchWeather.module.css';

const t = de.weather;
const v = de.catchView;
const hourBerlin = (iso: string) =>
  Number(new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }));

export function CatchWeather({ item }: { item: Catch }) {
  const enabled = useWeatherEnabled();
  const w = item.weather;
  const head = (
    <h3 className={styles.title}>
      <SkyIcon size={20} aria-hidden="true" /> {t.title}
    </h3>
  );
  if (!w) {
    if (!item.position || enabled === undefined) return null;
    const tooOld = nearestHour(item.at) < Date.parse(WEATHER_FROM);
    return (
      <section className={styles.box} aria-label={t.title}>
        {head}
        <p className="muted">
          {tooOld ? t.tooOld : enabled ? t.pending : <Link to="/mehr/einstellungen">{t.off}</Link>}
        </p>
      </section>
    );
  }
  const compass = w.windDirDeg === undefined ? undefined : t.compass[compassIndex(w.windDirDeg)];
  const night = (() => {
    const h = hourBerlin(w.forHour);
    return Number.isFinite(h) && (h < 6 || h >= 21);
  })();
  const sky = w.code === undefined ? undefined : (t.codes[w.code] ?? t.codeUnknown(w.code));
  const one = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const tiles = [
    w.windMs !== undefined && (
      <div className={styles.tile} key="wind">
        <WindIcon size={26} aria-hidden="true" />
        <span className={styles.label}>{t.wind}</span>
        <strong>
          {one(w.windMs)} m/s{compass && ` (${compass})`}
        </strong>
        {w.gustMs !== undefined && <small>{v.gust(w.gustMs)}</small>}
      </div>
    ),
    w.pressureHpa !== undefined && (
      <div className={styles.tile} key="pressure">
        <GaugeIcon size={26} aria-hidden="true" />
        <span className={styles.label}>{t.pressure}</span>
        <strong>{Math.round(w.pressureHpa)} hPa</strong>
        {w.pressureTrend3h !== undefined && <small>{v.pressureTrend(w.pressureTrend3h)}</small>}
      </div>
    ),
    w.cloudPct !== undefined && (
      <div className={styles.tile} key="clouds">
        <CloudIcon size={26} aria-hidden="true" />
        <span className={styles.label}>{t.clouds}</span>
        <strong>{t.pctValue(w.cloudPct)}</strong>
      </div>
    ),
    w.precipMm !== undefined && (
      <div className={styles.tile} key="precip">
        <DropIcon size={26} aria-hidden="true" />
        <span className={styles.label}>{t.precipShort}</span>
        <strong>{t.mmValue(w.precipMm)}</strong>
        <small>{v.precipSub}</small>
      </div>
    ),
  ].filter(Boolean);
  return (
    <section className={styles.box} aria-label={t.title}>
      {head}
      <div className={styles.grid}>
        {(sky || w.tempC !== undefined) && (
          <div className={`${styles.tile} ${styles.big}`}>
            {w.code !== undefined && <WeatherIcon icon={weatherIcon(w.code, night)} size={56} />}
            {sky && <span className={styles.sky}>{sky}</span>}
            {w.tempC !== undefined && <strong className={styles.temp}>{t.tempValue(w.tempC)}</strong>}
          </div>
        )}
        {tiles.length > 0 && <div className={styles.small}>{tiles}</div>}
      </div>
      <p className={styles.note}>
        <InfoIcon size={16} aria-hidden="true" />
        <span>
          {t.modelNote(formatDateTime(w.forHour))} {t.source}
        </span>
      </p>
    </section>
  );
}

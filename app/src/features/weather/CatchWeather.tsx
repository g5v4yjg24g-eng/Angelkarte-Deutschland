// Wetter eines Fangs: gespeicherte Modellwerte oder der Grund, warum (noch) keine da sind.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import type { Catch } from '../../domain/schemas';
import { compassIndex, nearestHour, WEATHER_FROM } from '../../domain/weather';
import { formatDateTime } from '../../lib/storage';
import { useWeatherEnabled } from './useWeatherEnabled';
import facts from '../catches/CatchFacts.module.css';
import styles from './CatchWeather.module.css';

const t = de.weather;

export function CatchWeather({ item }: { item: Catch }) {
  const enabled = useWeatherEnabled();
  const w = item.weather;
  if (!w) {
    if (!item.position || enabled === undefined) return null;
    const tooOld = nearestHour(item.at) < Date.parse(WEATHER_FROM);
    return (
      <section className={styles.box} aria-label={t.title}>
        <h3 className={styles.title}>{t.title}</h3>
        <p className="muted">
          {tooOld ? t.tooOld : enabled ? t.pending : <Link to="/mehr/einstellungen">{t.off}</Link>}
        </p>
      </section>
    );
  }
  const rows: [string, string | undefined][] = [
    [t.sky, w.code === undefined ? undefined : (t.codes[w.code] ?? t.codeUnknown(w.code))],
    [t.temp, w.tempC === undefined ? undefined : t.tempValue(w.tempC)],
    [
      t.wind,
      w.windMs === undefined
        ? undefined
        : t.windValue(
            w.windMs,
            w.windDirDeg === undefined ? undefined : t.compass[compassIndex(w.windDirDeg)],
            w.gustMs,
          ),
    ],
    [t.pressure, w.pressureHpa === undefined ? undefined : t.pressureValue(w.pressureHpa, w.pressureTrend3h)],
    [t.clouds, w.cloudPct === undefined ? undefined : t.pctValue(w.cloudPct)],
    [t.precip, w.precipMm === undefined ? undefined : t.mmValue(w.precipMm)],
  ];
  return (
    <section className={styles.box} aria-label={t.title}>
      <h3 className={styles.title}>{t.title}</h3>
      <dl className={facts.facts}>
        {rows
          .filter((r): r is [string, string] => !!r[1])
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <p className={`muted ${styles.note}`}>
        {t.modelNote(formatDateTime(w.forHour))} {t.source}
      </p>
    </section>
  );
}

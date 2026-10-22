// Wetter zu einem Angeltermin: Tageswerte aus der Vorhersage am Gewässer (nur die nächsten 7 Tage) und die
// Solunar-Hauptzeiten des Tages (offline, Theorie).
import { useMemo } from 'react';
import { de } from '../../i18n/de';
import { compassIndex } from '../../domain/weather';
import { daySummaries, forecastQuery } from '../../domain/forecast';
import { moonEvents, solunarWindows } from '../../domain/solunar';
import { addDays, dayStartMs, forecastStatus } from '../../domain/trip';
import type { Trip } from '../../domain/schemas';
import { useForecast } from '../weather/useForecast';
import styles from './Calendar.module.css';

const t = de.calendar;
const w = de.weather;
const f = de.forecast;
const hm = (ms: number) =>
  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const stamp = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });

function ForecastLine({ trip, lat, lng }: { trip: Trip; lat: number; lng: number }) {
  const q = useMemo(() => forecastQuery({ lat, lng }), [lat, lng]);
  const { state } = useForecast(q);
  const f0 = state.status === 'ok' ? state.forecast : state.status === 'loading' ? state.cached : undefined;
  const start = dayStartMs(trip.date, trip.tz);
  const day = f0 && daySummaries(f0).find((d) => d.t === start);
  if (!f0) return <p className="muted">{state.status === 'error' ? t.weatherError : t.weatherLoading}</p>;
  if (!day) return <p className="muted">{t.weatherError}</p>;
  const code = day.day.code;
  const wind = day.hours.find((h) => h.windMs === day.windMaxMs);
  return (
    <p className={styles.weather}>
      {[
        code !== undefined && (w.codes[code] ?? w.codeUnknown(code)),
        day.day.tMin !== undefined && day.day.tMax !== undefined && f.tempRange(day.day.tMin, day.day.tMax),
        day.day.precipSum !== undefined && f.precip(day.day.precipSum),
        day.windMaxMs !== undefined &&
          f.wind(day.windMaxMs, day.gustMaxMs) +
            (wind?.windDirDeg !== undefined ? ` ${w.compass[compassIndex(wind.windDirDeg)]}` : ''),
        day.pressureMin !== undefined &&
          day.pressureMax !== undefined &&
          t.pressureDay(day.pressureMin, day.pressureMax),
      ]
        .filter(Boolean)
        .join(' · ')}
      {state.status === 'ok' && state.stale && (
        <span className="muted"> ({t.weatherStale(stamp(f0.fetchedAt))})</span>
      )}
    </p>
  );
}

export function TripWeather({ trip, today, enabled }: { trip: Trip; today: string; enabled: boolean }) {
  const pos = trip.waterSnapshot?.centroid;
  const status = forecastStatus(trip.date, today);
  const majors = useMemo(() => {
    if (!pos) return [];
    const from = dayStartMs(trip.date, trip.tz);
    const to = dayStartMs(addDays(trip.date, 1), trip.tz);
    return solunarWindows(moonEvents(from, to, pos.lat, pos.lng)).filter((x) => x.kind === 'major');
  }, [pos, trip.date, trip.tz]);

  if (status.kind === 'past') return <p className="muted">{t.weatherPast}</p>;
  if (!pos) return <p className="muted">{t.weatherNoWater}</p>;
  return (
    <div className={styles.weatherBlock}>
      {!enabled ? (
        <p className="muted">{t.weatherOff}</p>
      ) : status.kind === 'later' ? (
        <p className="muted">{t.weatherLater(status.from)}</p>
      ) : (
        <ForecastLine trip={trip} lat={pos.lat} lng={pos.lng} />
      )}
      {majors.length > 0 && (
        <p className="muted">{t.solunarMajor(majors.map((m) => `${hm(m.from)}–${hm(m.to)}`).join(', '))}</p>
      )}
    </div>
  );
}

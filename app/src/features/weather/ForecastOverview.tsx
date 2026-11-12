// Übersicht (Vorlage Nutzer 2026-11-12): „Jetzt“-Karte mit Luftdruck, Wind und Luftfeuchte, Stundenleiste mit
// Sonnenauf-/untergang, 10-Tage-Liste mit Temperaturbalken; ein Tag öffnet das Detail.
import { useState } from 'react';
import { de } from '../../i18n/de';
import type { DaySummary, Forecast, ForecastHour } from '../../domain/forecast';
import { barSpan, hourStrip, pct, tempBounds, tempColor, weatherIcon } from '../../domain/forecastView';
import { ClockIcon, CalendarIcon, ChevronRightIcon } from '../../design/icons';
import { NowCard } from './NowCard';
import { WeatherIcon } from './WeatherIcon';
import { DayDetailSheet } from './DayDetailSheet';
import { OutlookChip } from './OutlookChip';
import { dayOutlook } from '../../domain/fishingOutlook';
import styles from './WeatherView.module.css';

const t = de.forecast;
const w = de.weather;
const tz = { timeZone: 'Europe/Berlin' } as const;
const berlinDate = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', tz);
const hourOf = (ms: number) =>
  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', ...tz }).slice(0, 2);
const time = (ms: number) =>
  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', ...tz });
const codeText = (c?: number) => (c === undefined ? '' : (w.codes[c] ?? w.codeUnknown(c)));
/** ab dieser Regenwahrscheinlichkeit steht die Zahl unter dem Symbol */
const SHOW_PRECIP = 30;

export function ForecastOverview({
  f,
  days,
  now,
  nowMs,
  change,
}: {
  f: Forecast;
  days: DaySummary[];
  now: ForecastHour | undefined;
  nowMs: number;
  change: number | undefined;
}) {
  const [openDay, setOpenDay] = useState<number>();
  const strip = hourStrip(f, nowMs, 24);
  const nowHour = strip.find((s) => s.kind === 'hour' && s.now);
  const nowIcon = nowHour?.kind === 'hour' ? nowHour.icon : undefined;
  const bounds = tempBounds(days.map((d) => d.day));
  const today = days.find((d) => berlinDate(d.t) === berlinDate(nowMs));
  const dayName = (ms: number) => (berlinDate(ms) === berlinDate(nowMs) ? t.today : t.weekdayShort(ms));

  return (
    <>
      <NowCard now={now} today={today} icon={nowIcon} change={change} />

      <section className={styles.card} aria-labelledby="wx-hourly">
        <h2 id="wx-hourly" className={styles.cardTitle}>
          <ClockIcon size={20} /> {t.hourly}
        </h2>
        <ol className={styles.strip} aria-label={t.hourlyLabel}>
          {strip.map((s) =>
            s.kind === 'hour' ? (
              <li key={s.t} className={`${styles.stripItem} ${s.now ? styles.stripNow : ''}`}>
                <span className={styles.stripTime}>{s.now ? t.now : t.hourLabel(hourOf(s.t))}</span>
                <span className={styles.stripIcon}>
                  <WeatherIcon icon={s.icon} size={30} />
                  {s.precipProb !== undefined && s.precipProb >= SHOW_PRECIP && (
                    <span className={styles.precip}>{t.precipPct(s.precipProb)}</span>
                  )}
                </span>
                <span className={styles.stripTemp}>{s.tempC !== undefined ? t.deg(s.tempC) : '–'}</span>
              </li>
            ) : (
              <li key={`${s.kind}-${s.t}`} className={`${styles.stripItem} ${styles.stripSun}`}>
                <span className={styles.stripTime}>{time(s.t)}</span>
                <span className={styles.stripIcon}>
                  <WeatherIcon icon={s.kind} size={30} />
                </span>
                <span className={styles.stripTemp}>{s.kind === 'sunrise' ? t.sunrise : t.sunset}</span>
              </li>
            ),
          )}
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="wx-days">
        <h2 id="wx-days" className={styles.cardTitle}>
          <CalendarIcon size={20} /> {t.tenDays(days.length)}
          {today && (
            <button
              type="button"
              className={styles.cardMore}
              aria-label={t.openToday}
              onClick={() => setOpenDay(today.t)}
            >
              <ChevronRightIcon size={20} />
            </button>
          )}
        </h2>
        <ul className={styles.dayList}>
          {days.map((d) => {
            const { tMin, tMax, code, precipProbMax } = d.day;
            const span =
              bounds && tMin !== undefined && tMax !== undefined ? barSpan(tMin, tMax, bounds) : undefined;
            const isToday = d === today;
            const dot = isToday && bounds && now?.tempC !== undefined ? pct(now.tempC, bounds) : undefined;
            return (
              <li key={d.t}>
                <button type="button" className={styles.dayRow} onClick={() => setOpenDay(d.t)}>
                  <span className={styles.dayName}>
                    {dayName(d.t)}
                    <OutlookChip level={dayOutlook(d).level} />
                  </span>
                  <span className="visually-hidden">{codeText(code)}</span>
                  <span className={styles.dayIcon}>
                    <WeatherIcon icon={weatherIcon(code, false)} size={30} />
                    {precipProbMax !== undefined && precipProbMax >= SHOW_PRECIP && (
                      <span className={styles.precip}>{t.precipPct(precipProbMax)}</span>
                    )}
                  </span>
                  <span className={styles.dayMin}>{tMin !== undefined ? t.deg(tMin) : '–'}</span>
                  <span className={styles.bar}>
                    {span && tMin !== undefined && tMax !== undefined && (
                      <span
                        className={styles.barFill}
                        style={{
                          left: `${span.left}%`,
                          width: `${span.width}%`,
                          background: `linear-gradient(90deg, ${tempColor(tMin)}, ${tempColor(tMax)})`,
                        }}
                      />
                    )}
                    {dot !== undefined && <span className={styles.barDot} style={{ left: `${dot}%` }} />}
                  </span>
                  <span className={styles.dayMax}>{tMax !== undefined ? t.deg(tMax) : '–'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <DayDetailSheet
        f={f}
        days={days}
        dayT={openDay}
        nowMs={nowMs}
        onChangeDay={setOpenDay}
        onClose={() => setOpenDay(undefined)}
      />
    </>
  );
}

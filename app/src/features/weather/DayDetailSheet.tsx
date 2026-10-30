// Tagesdetail (Wunsch Nutzer 2026-10-28, Vorbild iPhone-Wetter „Wetterlage“): Datumsleiste zum Wechseln, Temperatur
// des Tages mit Hoch/Tief, Kurve tatsächlich/gefühlt, Niederschlagswahrscheinlichkeit; für Angler zusätzlich Wind,
// Luftdruck und Sonnenzeiten. Natives dialog: Fokusfalle, Escape schließt.
import { useEffect, useMemo, useRef, useState } from 'react';
import { de } from '../../i18n/de';
import { IconButton } from '../../design/components/Button';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { CloseIcon } from '../../design/icons';
import { hourAt, type DaySummary, type Forecast } from '../../domain/forecast';
import { dayDetail, daySpan, isNight, solunarDay, weatherIcon } from '../../domain/forecastView';
import { phaseName } from '../../domain/solunar';
import { DayChart, type ChartPoint } from './DayChart';
import { WeatherIcon } from './WeatherIcon';
import styles from './WeatherView.module.css';

const t = de.forecast;
const w = de.weather;
const b = de.bite;
const HOUR = 3_600_000;
const tz = { timeZone: 'Europe/Berlin' } as const;
const berlinDate = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', tz);
const time = (ms: number) =>
  new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', ...tz });
const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...tz,
  });
const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'numeric', ...tz });
const codeText = (c?: number) => (c === undefined ? '' : (w.codes[c] ?? w.codeUnknown(c)));

const series = (
  hours: Forecast['hours'],
  key: 'tempC' | 'feelsC' | 'precipProb' | 'windMs' | 'pressureHpa',
): ChartPoint[] => hours.flatMap((h) => (typeof h[key] === 'number' ? [{ t: h.t, v: h[key] }] : []));
const range = (ps: ChartPoint[], f: (v: number) => string): [string, string] =>
  ps.length ? [f(Math.min(...ps.map((p) => p.v))), f(Math.max(...ps.map((p) => p.v)))] : ['', ''];

function DayBody({ f, day, nowMs }: { f: Forecast; day: DaySummary; nowMs: number }) {
  const [mode, setMode] = useState<'actual' | 'feels'>('actual');
  const detail = dayDetail(f, day.t);
  const isToday = berlinDate(day.t) === berlinDate(nowMs);
  const now = isToday ? hourAt(f, nowMs) : undefined;
  const big = now?.tempC ?? day.day.tMax;
  const temp = series(detail.hours, 'tempC');
  const feels = series(detail.hours, 'feelsC');
  const shown = mode === 'feels' && feels.length > 1 ? feels : temp;
  const markers =
    mode === 'actual'
      ? { hi: detail.hi, lo: detail.lo }
      : (() => {
          const hi = feels.reduce<ChartPoint | undefined>((m, p) => (!m || p.v > m.v ? p : m), undefined);
          const lo = feels.reduce<ChartPoint | undefined>((m, p) => (!m || p.v < m.v ? p : m), undefined);
          return { hi, lo };
        })();
  const icons = detail.hours
    .filter((h) => (h.t - day.t) % (2 * HOUR) === 0)
    .map((h) => ({ t: h.t + HOUR, icon: weatherIcon(h.code, isNight(f, h.t)) }));
  const precip = series(detail.hours, 'precipProb');
  const wind = series(detail.hours, 'windMs');
  const pressure = series(detail.hours, 'pressureHpa');
  const degF = (v: number) => t.deg(v);
  const [tLo, tHi] = range(shown, degF);
  const dayName = shortDate(day.t);

  return (
    <>
      <p className={styles.detailDate}>{longDate(day.t)}</p>
      <div className={styles.detailNow}>
        <div>
          <span className={styles.detailTemp}>
            {big !== undefined ? t.deg(big) : '–'}
            <WeatherIcon
              icon={weatherIcon(now?.code ?? day.day.code, now ? isNight(f, now.t) : false)}
              size={44}
            />
          </span>
          {day.day.tMax !== undefined && day.day.tMin !== undefined && (
            <p className="muted">{t.hiLo(day.day.tMax, day.day.tMin)}</p>
          )}
        </div>
        <p className={styles.detailSky}>{codeText(now?.code ?? day.day.code)}</p>
      </div>

      <section className={styles.detailSection} aria-labelledby="dd-temp">
        <h3 id="dd-temp">{t.tempChart}</h3>
        <DayChart
          points={shown}
          dayStart={day.t}
          nowMs={nowMs}
          label={t.chartLabel(
            mode === 'feels' ? `${t.tempChart} (${t.feels})` : t.tempChart,
            dayName,
            tLo,
            tHi,
          )}
          format={degF}
          markers={markers}
          icons={icons}
        />
        {feels.length > 1 && (
          <SegmentedControl
            label={t.seriesLabel}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'actual', label: t.actual },
              { value: 'feels', label: t.feels },
            ]}
          />
        )}
        <p className="muted">{mode === 'feels' ? t.feelsText : t.actualText}</p>
      </section>

      <section className={styles.detailSection} aria-labelledby="dd-precip">
        <h3 id="dd-precip">{t.precipChart}</h3>
        {detail.precipProbMax !== undefined && (
          <p className="muted">{t.precipDay(detail.precipProbMax, isToday)}</p>
        )}
        <DayChart
          points={precip}
          dayStart={day.t}
          nowMs={nowMs}
          fixed={{ min: 0, max: 100 }}
          label={t.chartLabel(t.precipChart, dayName, ...range(precip, t.precipPct))}
          format={t.precipPct}
          tone="precip"
        />
        {day.day.precipSum !== undefined && <p className="muted">{t.precipSum(day.day.precipSum)}</p>}
        <p className="muted">{t.precipNote}</p>
      </section>

      <section className={styles.detailSection} aria-labelledby="dd-wind">
        <h3 id="dd-wind">{t.windChart}</h3>
        {day.windMaxMs !== undefined && <p className="muted">{t.windSub(day.windMaxMs, day.gustMaxMs)}</p>}
        <DayChart
          points={wind}
          dayStart={day.t}
          nowMs={nowMs}
          label={t.chartLabel(t.windChart, dayName, ...range(wind, (v) => `${Math.round(v)} m/s`))}
          format={(v) => `${Math.round(v)} m/s`}
          tone="wind"
        />
      </section>

      <section className={styles.detailSection} aria-labelledby="dd-pressure">
        <h3 id="dd-pressure">{t.pressureDay}</h3>
        {day.pressureMin !== undefined && day.pressureMax !== undefined && (
          <p className="muted">{t.pressureSub(day.pressureMin, day.pressureMax, day.pressureDelta)}</p>
        )}
        <DayChart
          points={pressure}
          dayStart={day.t}
          nowMs={nowMs}
          label={t.chartLabel(t.pressureDay, dayName, ...range(pressure, (v) => `${Math.round(v)} hPa`))}
          format={(v) => `${Math.round(v)}`}
          tone="pressure"
        />
      </section>

      {day.day.sunrise !== undefined && day.day.sunset !== undefined && (
        <section className={styles.detailSection} aria-labelledby="dd-sun">
          <h3 id="dd-sun">{t.sunTitle}</h3>
          <p className={styles.sunRow}>
            <WeatherIcon icon="sunrise" size={26} />
            <span>{t.sunTimes(time(day.day.sunrise), time(day.day.sunset))}</span>
            <WeatherIcon icon="sunset" size={26} />
          </p>
        </section>
      )}
      <SolunarSection f={f} dayT={day.t} />
      <p className="muted">{t.note}</p>
    </>
  );
}

/** Solunar-Zeiten des Tages (Wunsch Nutzer 2026-10-30): Leiste 0–24 Uhr und Liste, immer mit Theorie-Hinweis */
function SolunarSection({ f, dayT }: { f: Forecast; dayT: number }) {
  const s = useMemo(() => solunarDay(f, dayT), [f, dayT]);
  const end = f.days[f.days.findIndex((d) => d.t === dayT) + 1]?.t ?? dayT + 24 * HOUR;
  return (
    <section className={styles.detailSection} aria-labelledby="dd-solunar">
      <h3 id="dd-solunar">{b.solunarTitle}</h3>
      <p className="muted">{b.phase(b.phases[phaseName(s.phase.phase)], Math.round(s.phase.fraction * 100))}</p>
      {s.windows.length === 0 ? (
        <p className="muted">{b.none}</p>
      ) : (
        <>
          <div className={styles.solunarBar} aria-hidden="true">
            {s.windows.map((x) => {
              const span = daySpan(x.from, x.to, dayT, end);
              return (
                <span
                  key={x.event}
                  className={x.kind === 'major' ? styles.solunarMajor : styles.solunarMinor}
                  style={{ left: `${span.left}%`, width: `${span.width}%` }}
                />
              );
            })}
            {[6, 12, 18].map((h) => (
              <i key={h} style={{ left: `${(h / 24) * 100}%` }} />
            ))}
          </div>
          <div className={styles.solunarAxis} aria-hidden="true">
            {[0, 6, 12, 18, 24].map((h) => (
              <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
                {t.hourLabel(String(h).padStart(2, '0'))}
              </span>
            ))}
          </div>
          <ul className={styles.solunarList}>
            {s.windows.map((x) => (
              <li key={x.event}>
                <span className={x.kind === 'major' ? styles.solunarMajor : styles.solunarMinor} />
                <span className="tabular">{b.window(time(x.from), time(x.to))}</span>
                <span>
                  {x.kind === 'major' ? b.major : b.minor} · {b.events[x.event]} {time(x.center)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted">{b.solunarDisclaimer}</p>
    </section>
  );
}

export function DayDetailSheet({
  f,
  days,
  dayT,
  nowMs,
  onChangeDay,
  onClose,
}: {
  f: Forecast;
  days: DaySummary[];
  dayT: number | undefined;
  nowMs: number;
  onChangeDay: (t: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = dayT !== undefined;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const day = days.find((d) => d.t === dayT);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby="day-detail-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && day && (
        <div className={styles.sheetInner}>
          <header className={styles.sheetHead}>
            <IconButton
              label={de.common.close}
              icon={<CloseIcon />}
              onClick={onClose}
              className={styles.sheetClose}
            />
            <h2 id="day-detail-title">
              <WeatherIcon icon="cloudy" size={26} />
              {t.detailTitle}
            </h2>
          </header>
          <div className={styles.dateStrip} role="group" aria-label={t.detailDays}>
            {days.map((d) => (
              <button
                key={d.t}
                type="button"
                className={styles.dateButton}
                aria-pressed={d.t === day.t}
                onClick={() => onChangeDay(d.t)}
              >
                <span className="visually-hidden">{shortDate(d.t)}</span>
                <span className={styles.dateWeekday} aria-hidden="true">
                  {t.weekdayShort(d.t).slice(0, 2)}
                </span>
                <span className={styles.dateNum}>
                  {new Date(d.t).toLocaleDateString('de-DE', { day: 'numeric', ...tz }).replace('.', '')}
                </span>
              </button>
            ))}
          </div>
          <div className={styles.sheetBody}>
            <DayBody key={day.t} f={f} day={day} nowMs={nowMs} />
          </div>
        </div>
      )}
    </dialog>
  );
}

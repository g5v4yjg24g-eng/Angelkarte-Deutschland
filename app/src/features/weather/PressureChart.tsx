// Luftdruck-Verlauf als Linie (eine Datenreihe, Diagrammfarbe), Tagesgrenzen und „jetzt"; Tabelle je Tag zum
// Aufklappen (wie die Statistik, TEST_PLAN STA-7).
import { useId } from 'react';
import { de } from '../../i18n/de';
import type { DaySummary, ForecastHour } from '../../domain/forecast';
import styles from './Weather.module.css';

const t = de.forecast;
const weekday = (ms: number) =>
  new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' });
const dayLabel = (ms: number) =>
  new Date(ms).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Europe/Berlin',
  });

export function PressureChart({
  hours,
  days,
  nowMs,
}: {
  hours: ForecastHour[];
  days: DaySummary[];
  nowMs: number;
}) {
  const id = useId();
  const pts = hours.filter((h): h is ForecastHour & { pressureHpa: number } => h.pressureHpa !== undefined);
  if (pts.length < 2) return null;
  const W = 340;
  const H = 150;
  const pad = { l: 34, r: 6, top: 10, bottom: 20 };
  const t0 = pts[0]?.t ?? 0;
  const t1 = pts.at(-1)?.t ?? 1;
  const ps = pts.map((p) => p.pressureHpa);
  const lo = Math.floor(Math.min(...ps) - 1);
  const hi = Math.ceil(Math.max(...ps) + 1);
  const x = (ms: number) => pad.l + ((ms - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (p: number) => pad.top + ((hi - p) / (hi - lo)) * (H - pad.top - pad.bottom);
  const path = pts
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.pressureHpa).toFixed(1)}`)
    .join(' ');
  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>
          {t.pressureChartTitle(Math.round(Math.min(...ps)), Math.round(Math.max(...ps)))}
        </title>
        {[lo, Math.round((lo + hi) / 2), hi].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={styles.grid} />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" className={styles.tick}>
              {v}
            </text>
          </g>
        ))}
        {days
          .filter((d) => d.t > t0 && d.t < t1)
          .map((d) => (
            <g key={d.t}>
              <line x1={x(d.t)} x2={x(d.t)} y1={pad.top} y2={H - pad.bottom} className={styles.grid} />
              <text x={x(d.t) + 2} y={H - 6} className={styles.tick}>
                {weekday(d.t)}
              </text>
            </g>
          ))}
        <path d={path} className={styles.line} />
        {nowMs > t0 && nowMs < t1 && (
          <g>
            <line x1={x(nowMs)} x2={x(nowMs)} y1={pad.top} y2={H - pad.bottom} className={styles.now} />
            <text x={x(nowMs) + 3} y={pad.top + 8} className={styles.nowLabel}>
              {t.nowMarker}
            </text>
          </g>
        )}
      </svg>
      <details className={styles.tableToggle}>
        <summary>{de.stats.showTable}</summary>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th scope="col">{t.tableDay}</th>
              <th scope="col">{t.tableMin}</th>
              <th scope="col">{t.tableMax}</th>
              <th scope="col">{t.tableChange}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.t}>
                <th scope="row">{dayLabel(d.t)}</th>
                <td className="tabular">
                  {d.pressureMin === undefined ? '–' : `${Math.round(d.pressureMin)} hPa`}
                </td>
                <td className="tabular">
                  {d.pressureMax === undefined ? '–' : `${Math.round(d.pressureMax)} hPa`}
                </td>
                <td className="tabular">
                  {d.pressureDelta === undefined ? '–' : t.signedHpa(d.pressureDelta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

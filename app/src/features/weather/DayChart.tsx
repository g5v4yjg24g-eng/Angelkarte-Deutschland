// Tagesdiagramm (Vorbild iPhone-Wetter): 0–24 Uhr, Achse rechts, vergangene Stunden gestrichelt und abgedunkelt,
// Hoch/Tief-Marken, optional Symbolzeile darüber. Eine Datenreihe je Diagramm.
import { useId } from 'react';
import { de } from '../../i18n/de';
import { niceTicks, type WeatherIconKey } from '../../domain/forecastView';
import { WeatherIcon } from './WeatherIcon';
import styles from './WeatherView.module.css';

const t = de.forecast;
const HOUR = 3_600_000;
const W = 340;
const H = 170;
const PAD = { l: 4, r: 40, top: 12, bottom: 22 };

export interface ChartPoint {
  t: number;
  v: number;
}

export function DayChart({
  points,
  dayStart,
  nowMs,
  label,
  format,
  fixed,
  markers,
  icons,
  tone = 'temp',
}: {
  points: ChartPoint[];
  dayStart: number;
  nowMs: number;
  label: string;
  /** Achsenbeschriftung */
  format: (v: number) => string;
  /** feste Achse (z. B. 0–100 %) */
  fixed?: { min: number; max: number };
  markers?: { hi?: ChartPoint | undefined; lo?: ChartPoint | undefined };
  icons?: { t: number; icon: WeatherIconKey }[];
  tone?: 'temp' | 'precip' | 'wind' | 'pressure';
}) {
  const id = useId().replace(/:/g, '');
  const pts = [...points].sort((a, b) => a.t - b.t);
  if (pts.length < 2) return <p className="muted">{t.noHourly}</p>;
  const vs = pts.map((p) => p.v);
  const pad = tone === 'pressure' ? 1 : 2;
  // Wind und Regen können nicht unter 0 fallen
  const floor = tone === 'wind' || tone === 'precip' ? 0 : -Infinity;
  const ticks = fixed
    ? niceTicks(fixed.min, fixed.max)
    : niceTicks(Math.max(floor, Math.min(...vs) - pad), Math.max(...vs) + pad, 4);
  const lo = ticks[0] ?? 0;
  const hi = ticks.at(-1) ?? 1;
  const x = (ms: number) => PAD.l + ((ms - dayStart) / (24 * HOUR)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
  const line = (ps: ChartPoint[]) =>
    ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const nowX = nowMs > dayStart && nowMs < dayStart + 24 * HOUR ? x(nowMs) : undefined;
  const past =
    nowX === undefined ? (nowMs >= dayStart + 24 * HOUR ? pts : []) : pts.filter((p) => p.t <= nowMs);
  const future =
    nowX === undefined ? (nowMs >= dayStart + 24 * HOUR ? [] : pts) : pts.filter((p) => p.t >= nowMs);
  // Übergang ohne Lücke: letzter vergangener Punkt beginnt die Zukunft
  const futureLine = past.length && future.length ? [past[past.length - 1] as ChartPoint, ...future] : future;
  const area = `${line(pts)}L${x(pts[pts.length - 1]?.t ?? 0).toFixed(1)} ${H - PAD.bottom}L${x(pts[0]?.t ?? 0).toFixed(1)} ${H - PAD.bottom}Z`;
  const bottom = H - PAD.bottom;

  return (
    <figure className={styles.dayFigure}>
      {icons && (
        <div className={styles.iconRow} aria-hidden="true">
          {icons.map((i) => (
            <span key={i.t} style={{ left: `${(x(i.t) / W) * 100}%` }}>
              <WeatherIcon icon={i.icon} size={22} />
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.dayChart} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles[`${tone}Stop1`]} />
            <stop offset="100%" className={styles[`${tone}Stop2`]} />
          </linearGradient>
          <pattern
            id={`h${id}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" className={styles.hatch} />
          </pattern>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={styles.gridLine} />
            <text x={W - PAD.r + 6} y={y(v) + 4} className={styles.axis}>
              {format(v)}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18].map((h) => (
          <g key={h}>
            <line
              x1={x(dayStart + h * HOUR)}
              x2={x(dayStart + h * HOUR)}
              y1={PAD.top}
              y2={bottom}
              className={styles.gridDash}
            />
            <text x={x(dayStart + h * HOUR) + 3} y={H - 6} className={styles.axis}>
              {t.hourLabel(String(h).padStart(2, '0'))}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#g${id})`} />
        {nowX !== undefined && (
          <rect
            x={PAD.l}
            y={PAD.top}
            width={nowX - PAD.l}
            height={bottom - PAD.top}
            fill={`url(#h${id})`}
            className={styles.pastShade}
          />
        )}
        {past.length > 1 && (
          <path d={line(past)} className={`${styles.series} ${styles[`${tone}Line`]} ${styles.pastLine}`} />
        )}
        {futureLine.length > 1 && (
          <path d={line(futureLine)} className={`${styles.series} ${styles[`${tone}Line`]}`} />
        )}
        {nowX !== undefined && (
          <line x1={nowX} x2={nowX} y1={PAD.top} y2={bottom} className={styles.nowLine} />
        )}
        {markers?.hi && (
          <g>
            <circle cx={x(markers.hi.t)} cy={y(markers.hi.v)} r={4} className={styles.marker} />
            <text x={x(markers.hi.t)} y={y(markers.hi.v) - 9} className={styles.markerText}>
              H
            </text>
          </g>
        )}
        {markers?.lo && (
          <g>
            <circle cx={x(markers.lo.t)} cy={y(markers.lo.v)} r={4} className={styles.marker} />
            <text x={x(markers.lo.t)} y={y(markers.lo.v) + 18} className={styles.markerText}>
              T
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

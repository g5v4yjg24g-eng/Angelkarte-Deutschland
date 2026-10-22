// Diagramme der Statistik: eine Datenreihe je Grafik (Markenfarbe --color-chart), Werte immer als Text,
// jede Grafik mit Tabelle (TEST_PLAN STA-7). Keine Diagramm-Bibliothek nötig.
import { useId } from 'react';
import { de } from '../../i18n/de';
import styles from './Stats.module.css';

const fmt = (n: number) => n.toLocaleString('de-DE');

/** Kennzahl mit Erklärung; ohne genug Daten statt Zahl „Zu wenige Daten (n = …)". */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </div>
  );
}

/** Horizontale Balken als Tabelle: Bezeichnung, Balken, Zahl (Zusatz z. B. „n = 5"). */
export function BarTable({
  caption,
  rows,
}: {
  caption: string;
  rows: { label: string; value: number; extra?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <table className={styles.bars}>
      <caption className="visually-hidden">{caption}</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">{caption}</th>
          <th scope="col">{de.stats.count}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} title={de.stats.barLabel(r.label, r.value)}>
            <th scope="row">
              <span className={styles.barLabel}>{r.label}</span>
              <span className={styles.barTrack} aria-hidden="true">
                {r.value > 0 && (
                  <span className={styles.bar} style={{ width: `${(r.value / max) * 100}%` }} />
                )}
              </span>
            </th>
            <td className="tabular">
              {fmt(r.value)}
              {r.extra && <span className={styles.barExtra}> {r.extra}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Säulen über die Zeit; leere Perioden als 0. Tooltip je Säule, Tabelle zum Aufklappen. */
export function Timeline({
  title,
  points,
  label,
}: {
  title: string;
  points: { key: string; value: number }[];
  label: (key: string) => string;
}) {
  const id = useId();
  const max = Math.max(1, ...points.map((p) => p.value));
  const W = 320;
  const H = 120;
  const pad = { top: 14, bottom: 18 };
  const slot = W / Math.max(1, points.length);
  const bw = Math.min(24, Math.max(2, slot - 2)); // ≤ 24 px, 2 px Luft
  const plotH = H - pad.top - pad.bottom;
  const peak = points.reduce<{ key: string; value: number } | undefined>(
    (a, p) => (!a || p.value > a.value ? p : a),
    undefined,
  );
  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.timeline} role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{title}</title>
        <line x1={0} x2={W} y1={H - pad.bottom} y2={H - pad.bottom} className={styles.axis} />
        {points.map((p, i) => {
          const h = (p.value / max) * plotH;
          const x = i * slot + (slot - bw) / 2;
          const y = H - pad.bottom - h;
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={p.key} className={styles.col}>
              <title>{`${label(p.key)}: ${fmt(p.value)}`}</title>
              {/* Trefferfläche größer als die Säule */}
              <rect x={i * slot} y={pad.top} width={slot} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  className={styles.colMark}
                  d={`M${x},${H - pad.bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H - pad.bottom} Z`}
                />
              )}
            </g>
          );
        })}
        {peak && peak.value > 0 && (
          <text
            x={points.indexOf(peak) * slot + slot / 2}
            y={H - pad.bottom - (peak.value / max) * plotH - 4}
            textAnchor="middle"
            className={styles.valueLabel}
          >
            {fmt(peak.value)}
          </text>
        )}
        {points.length > 0 && (
          <>
            <text x={0} y={H - 4} className={styles.tick}>
              {label(points[0]?.key ?? '')}
            </text>
            {points.length > 1 && (
              <text x={W} y={H - 4} textAnchor="end" className={styles.tick}>
                {label(points.at(-1)?.key ?? '')}
              </text>
            )}
          </>
        )}
      </svg>
      <details className={styles.tableToggle}>
        <summary>{de.stats.showTable}</summary>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th scope="col">{de.stats.period}</th>
              <th scope="col">{de.stats.caught}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key}>
                <td>{label(p.key)}</td>
                <td className="tabular">{fmt(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

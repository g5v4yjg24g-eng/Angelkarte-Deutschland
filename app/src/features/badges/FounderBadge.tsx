// FOUNDER-Abzeichen (Wunsch Nutzer 2026-11-03): Medaille in Gold mit dem Fangpunkt-Fisch aus dem Marken-Master.
// „full“ für das eigene Profil (Medaille + Schriftzug), „compact“ neben Namen bei Beiträgen, Kommentaren, Listen.
import { useId } from 'react';
import fish from '../../design/brand/fish.json';
import { de } from '../../i18n/de';
import styles from './FounderBadge.module.css';

const t = de.badges;

/** Goldmedaille mit eingeprägtem Fisch */
function Medal({ size }: { size: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={styles.medal}>
      <defs>
        <linearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7e7a8" />
          <stop offset="0.35" stopColor="#d9b44a" />
          <stop offset="0.65" stopColor="#a87b1e" />
          <stop offset="1" stopColor="#f0d47a" />
        </linearGradient>
        <radialGradient id={`face${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fbefc0" />
          <stop offset="0.55" stopColor="#e2bf55" />
          <stop offset="1" stopColor="#b98a26" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#rim${id})`} />
      <circle cx="50" cy="50" r="40" fill={`url(#face${id})`} />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#8a6416" strokeOpacity="0.45" strokeWidth="1.5" />
      <g transform="translate(50 50) scale(0.62) translate(-50 -50)" fill="#4a3406">
        <path d={fish.tail} />
        {fish.fins.map((d) => (
          <path key={d} d={d} />
        ))}
        <path d={fish.body} />
        <path d={fish.gill} fill="none" stroke="#f3dc8c" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx={fish.eye.cx} cy={fish.eye.cy} r={fish.eye.r} fill="#f3dc8c" />
      </g>
      {/* Glanzlicht */}
      <path
        d="M22 34a32 32 0 0 1 30-20"
        fill="none"
        stroke="#fffbe8"
        strokeOpacity="0.7"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FounderBadge({ variant = 'compact' }: { variant?: 'full' | 'compact' }) {
  if (variant === 'compact')
    return (
      <span className={styles.compact} role="img" aria-label={t.founderLabel} title={t.founderLabel}>
        <Medal size={18} />
      </span>
    );
  return (
    <span className={styles.full} role="img" aria-label={t.founderLabel}>
      <Medal size={28} />
      <span className={styles.word} aria-hidden="true">
        {t.founder}
      </span>
    </span>
  );
}

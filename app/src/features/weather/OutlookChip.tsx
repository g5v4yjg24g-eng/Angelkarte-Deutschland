// Beißprognose als kleines Etikett (Paket 5): Wort und Farbe – nie nur Farbe.
import { de } from '../../i18n/de';
import type { OutlookLevel } from '../../domain/fishingOutlook';
import styles from './WeatherView.module.css';

const CLASS: Record<Exclude<OutlookLevel, 'unknown'>, string | undefined> = {
  good: styles.chipGood,
  medium: styles.chipMedium,
  hard: styles.chipHard,
};

export function OutlookChip({ level }: { level: OutlookLevel }) {
  if (level === 'unknown') return null;
  return (
    <span className={[styles.outlookChip, CLASS[level]].join(' ')}>
      <span className="visually-hidden">{de.outlook.label}: </span>
      {de.outlook.levels[level]}
    </span>
  );
}

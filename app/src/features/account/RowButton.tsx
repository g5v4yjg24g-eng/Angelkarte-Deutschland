// Zeile in einer Karte, die eine Aktion auslöst oder einen Bereich aufklappt (Kontodetails, Vorlage Nutzer
// 2026-11-11). Sieht aus wie eine Menüzeile (ListLink), ist aber ein Knopf.
import type { ReactNode } from 'react';
import { ChevronRightIcon } from '../../design/icons';
import styles from './Account.module.css';

export function RowButton({
  icon,
  title,
  hint,
  onClick,
  disabled,
  danger,
  expanded,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** für Zeilen, die etwas aufklappen */
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={danger ? `${styles.row} ${styles.rowDanger}` : styles.row}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
    >
      <span className={styles.rowIcon}>{icon}</span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {hint && <span className={styles.rowHint}>{hint}</span>}
      </span>
      <ChevronRightIcon className={styles.rowChevron} size={20} />
    </button>
  );
}

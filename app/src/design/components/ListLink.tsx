import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRightIcon } from '../icons';
import styles from './ListLink.module.css';

/** Zeile in einer Menüliste. Ohne "to" wird sie als deaktiviert (noch nicht verfügbar) gezeigt. */
export function ListLink({
  to,
  icon,
  title,
  hint,
  badge,
}: {
  to?: string;
  icon: ReactNode;
  title: string;
  hint?: string;
  badge?: ReactNode;
}) {
  const content = (
    <>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      {badge}
      {to && <ChevronRightIcon className={styles.chevron} size={20} />}
    </>
  );
  return to ? (
    <Link to={to} className={styles.row}>
      {content}
    </Link>
  ) : (
    <div className={[styles.row, styles.disabled].join(' ')} aria-disabled="true">
      {content}
    </div>
  );
}

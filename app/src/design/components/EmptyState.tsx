import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

/** Erklärender Leerzustand: was hier erscheint und wie man dahin kommt. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  note,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  note?: string;
}) {
  return (
    <section className={styles.empty} aria-labelledby="empty-title">
      <div className={styles.icon}>{icon}</div>
      <h2 id="empty-title">{title}</h2>
      <p className={styles.text}>{children}</p>
      {action}
      {note && <p className={styles.note}>{note}</p>}
    </section>
  );
}

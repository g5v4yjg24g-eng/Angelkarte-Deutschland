import type { ReactNode } from 'react';
import styles from './Toast.module.css';

/** Dauerhafter Hinweis mit Aktionen (z. B. Update). Wird über role="status" angesagt. */
export function Toast({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={styles.toast} role="status">
      <p>{children}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

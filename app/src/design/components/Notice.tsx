import type { ReactNode } from 'react';
import styles from './Notice.module.css';

/** Hinweis im Seitenfluss. Fehler werden sofort angesagt (role="alert"), sonst höflich (role="status"). */
export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  return (
    <div className={[styles.notice, styles[tone]].join(' ')} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

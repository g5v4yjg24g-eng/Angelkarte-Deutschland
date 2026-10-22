import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeftIcon } from '../icons';
import { de } from '../../i18n/de';
import styles from './Page.module.css';

/** Seitenrahmen mit Überschrift; optional Zurück-Link für Unterseiten. */
export function Page({ title, back, children }: { title: string; back?: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        {back && (
          <Link to={back} className={styles.back} aria-label={de.common.back}>
            <ChevronLeftIcon />
          </Link>
        )}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  // Mit Überschrift benannt: Screenreader führen den Abschnitt als Bereich
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={title ? id : undefined}>
      {title && (
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

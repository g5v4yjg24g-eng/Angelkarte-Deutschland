// Abschnitt im Fangformular (Vorlage Nutzer 2026-11-13): kleines Symbol vor der Überschrift, Inhalt darunter.
import type { ReactNode } from 'react';
import styles from './CatchForm.module.css';

export function FormSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon} aria-hidden="true">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

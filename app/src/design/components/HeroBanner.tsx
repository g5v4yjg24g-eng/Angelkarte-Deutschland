// Kopfkarte einer Seite vor dem Sonnenuntergang (gleiche Karte wie die Kontodetails): Symbol, Titel, kurze Zeile.
import type { ReactNode } from 'react';
import { SunsetScene } from './SunsetScene';
import styles from './HeroBanner.module.css';

export function HeroBanner({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string | undefined;
}) {
  return (
    <section className={styles.card} aria-label={title}>
      <SunsetScene />
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.text}>
        <strong className={styles.title}>{title}</strong>
        {subtitle && <span className={styles.sub}>{subtitle}</span>}
      </div>
    </section>
  );
}

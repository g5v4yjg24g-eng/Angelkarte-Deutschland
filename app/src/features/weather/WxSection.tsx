// Karte im Wetter-Bereich (Vorlage Nutzer 2026-11-12): Überschrift mit Symbol, Inhalt darunter – gleiche Optik für
// Luftdruck-Verlauf, Beißprognose und Pegel wie bei „Stündlich“ und „10-Tage-Vorhersage“.
import type { ReactNode } from 'react';
import styles from './WeatherView.module.css';

export function WxSection({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

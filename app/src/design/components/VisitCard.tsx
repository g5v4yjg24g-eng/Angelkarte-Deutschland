// Visitenkarte (Wunsch Nutzer 2026-11-11): Profilbild, Name, Abzeichen, @Name, eine kleine Zeile (E-Mail bzw. Erfolge)
// und ein Stand mit Punkt – vor einem Sonnenuntergang. Gemeinsam für Kontodetails und „Gemeinsam angeln“.
import type { ReactNode } from 'react';
import { SunsetScene } from './SunsetScene';
import styles from './VisitCard.module.css';

export type VisitTone = 'success' | 'waiting' | 'muted' | 'danger';

export function VisitCard({
  label,
  avatar,
  avatarAction,
  name,
  badge,
  handle,
  detail,
  status,
  footer,
}: {
  /** Name des Bereichs für Screenreader */
  label: string;
  avatar: ReactNode;
  /** kleiner Knopf unten rechts am Profilbild (z. B. Stift) */
  avatarAction?: ReactNode;
  name: string;
  badge?: ReactNode;
  handle: string;
  /** kleine Zeile unter dem Namen (E-Mail, Erfolge …) */
  detail?: ReactNode;
  status?: { label: string; tone: VisitTone };
  /** Inhalt unter der Karte (z. B. Angaben und Knöpfe einer Einladung), innerhalb des Rahmens */
  footer?: ReactNode;
}) {
  return (
    <section className={styles.card} aria-label={label}>
      <SunsetScene />
      <div className={styles.top}>
        <span className={styles.avatar}>
          {avatar}
          {avatarAction}
        </span>
        <div className={styles.text}>
          <strong className={styles.name}>{name}</strong>
          {badge}
          <span className="muted">{handle}</span>
          {detail}
          {status && (
            <span className={styles.status}>
              <span className={`${styles.dot} ${styles[status.tone] ?? ''}`} aria-hidden="true" />
              {status.label}
            </span>
          )}
        </div>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}

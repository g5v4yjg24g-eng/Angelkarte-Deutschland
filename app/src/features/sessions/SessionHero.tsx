// Kopf der Session-Ansicht (Vorlage Nutzer 2026-11-11): Sonnenuntergang als Bild, Art der Session, Titel, Stift.
import { de } from '../../i18n/de';
import { IconButton } from '../../design/components/Button';
import { SunsetScene } from '../../design/components/SunsetScene';
import { HookIcon, PencilIcon } from '../../design/icons';
import styles from './Sessions.module.css';

const t = de.sessions;

export function SessionHero({
  running,
  title,
  onEdit,
}: {
  running: boolean;
  title: string;
  onEdit: () => void;
}) {
  return (
    <section className={styles.hero} aria-label={running ? t.heroActive : t.heroEnded}>
      <SunsetScene variant="full" />
      <div className={styles.heroText}>
        <span className={styles.heroLabel}>
          <HookIcon size={18} />
          {running ? t.heroActive : t.heroEnded}
        </span>
        <h2 className={styles.heroTitle}>{title}</h2>
      </div>
      <IconButton
        className={styles.heroEdit ?? ''}
        label={t.edit}
        icon={<PencilIcon size={18} />}
        onClick={onEdit}
      />
    </section>
  );
}

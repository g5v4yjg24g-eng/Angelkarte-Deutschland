// Großes Profilbild als Vollbild-Fenster (natives dialog: Escape, Fokus). Ein Tippen oder der Hintergrund schließt.
import { useEffect, useRef } from 'react';
import { de } from '../../i18n/de';
import styles from './AvatarZoom.module.css';

/** Ein Tippen direkt nach dem Öffnen (der noch drückende Finger) darf das Fenster nicht gleich wieder schließen */
const IGNORE_CLOSE_MS = 350;

export function AvatarLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const openedAt = useRef(0);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      openedAt.current = Date.now();
      d.showModal();
    }
  }, []);
  const close = () => {
    if (Date.now() - openedAt.current < IGNORE_CLOSE_MS) return;
    onClose();
  };
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={de.profile.avatarZoom}
      onClick={close}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <img src={url} alt={de.profile.avatarAlt} className={styles.big} draggable={false} />
    </dialog>
  );
}

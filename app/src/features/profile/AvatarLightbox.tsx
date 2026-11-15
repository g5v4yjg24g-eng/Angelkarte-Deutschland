// Großes Profilbild als Vollbild-Fenster (natives dialog: Escape, Fokus). Ein Tippen oder der Hintergrund schließt.
import { useEffect, useRef } from 'react';
import { de } from '../../i18n/de';
import styles from './AvatarZoom.module.css';

export function AvatarLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Das Loslassen des Fingers, der das Fenster geöffnet hat, erzeugt ein Antippen – das darf nicht schließen, egal wie
  // lange gedrückt wurde. Geschlossen wird nur nach einem neuen Druck auf das Fenster selbst.
  const armed = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const close = () => {
    if (armed.current) onClose();
  };
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={de.profile.avatarZoom}
      onPointerDown={() => {
        armed.current = true;
      }}
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

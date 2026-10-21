import { useEffect, useRef } from 'react';
import { CloseIcon } from '../icons';
import styles from './Lightbox.module.css';

/** Bild bildschirmfüllend anzeigen (natives dialog: Fokusfalle, Escape, liegt über Sheets). */
export function Lightbox({
  src,
  alt,
  closeLabel,
  onClose,
}: {
  src: string;
  alt: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.box}
      aria-label={alt}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <img src={src} alt={alt} className={styles.img} />
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
        <CloseIcon />
      </button>
    </dialog>
  );
}

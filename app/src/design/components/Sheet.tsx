import { useEffect, useId, useRef, type ReactNode } from 'react';
import { de } from '../../i18n/de';
import { CloseIcon } from '../icons';
import { IconButton } from './Button';
import styles from './Sheet.module.css';

/**
 * Bottom Sheet auf Basis von <dialog> (Fokusfalle, Escape und Screenreader-Verhalten kommen vom Browser).
 * Auf breiten Bildschirmen erscheint es als Karte rechts.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Das „close"-Ereignis kommt zeitversetzt. Schließt die App selbst und öffnet gleich ein neues Sheet,
  // darf das verspätete Ereignis dieses nicht wieder schließen: selbst ausgelöste Schließungen zählen.
  const ownCloses = useRef(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      ownCloses.current++;
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={() => {
        if (ownCloses.current > 0) ownCloses.current--;
        else onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Klick auf den abgedunkelten Hintergrund schließt
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.inner}>
          <div className={styles.handle} aria-hidden="true" />
          <header className={styles.header}>
            <h2 id={titleId}>{title}</h2>
            <IconButton label={de.common.close} icon={<CloseIcon />} onClick={onClose} />
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

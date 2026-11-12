import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { de } from '../../i18n/de';
import { ChevronLeftIcon, CloseIcon } from '../icons';
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
  hero,
  returnFocus,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Kopfbild über dem Inhalt (ersetzt Griff und Kopfzeile); Zurück-Knopf liegt fest oben links */
  hero?: ReactNode;
  /** Ziel für den Fokus nach dem Schließen, falls der Auslöser inzwischen verschwunden ist */
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Das „close"-Ereignis kommt zeitversetzt. Schließt die App selbst und öffnet gleich ein neues Sheet,
  // darf das verspätete Ereignis dieses nicht wieder schließen: selbst ausgelöste Schließungen zählen.
  const ownCloses = useRef(0);
  // Der Browser gibt den Fokus beim Schließen an den Auslöser zurück – nur wenn es ihn noch gibt
  const opener = useRef<HTMLElement | null>(null);
  const lostOpener = () => !opener.current || !opener.current.isConnected || opener.current === document.body;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
    }
    if (!open && d.open) {
      ownCloses.current++;
      d.close();
      if (lostOpener()) returnFocus?.current?.focus();
    }
  }, [open, returnFocus]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={() => {
        if (ownCloses.current > 0) ownCloses.current--;
        else onClose();
        if (lostOpener()) returnFocus?.current?.focus();
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
        <div className={[styles.inner, hero ? styles.withHero : ''].join(' ')}>
          {hero ? (
            <>
              <h2 id={titleId} className="visually-hidden">
                {title}
              </h2>
              <button type="button" className={styles.back} aria-label={de.common.close} onClick={onClose}>
                <ChevronLeftIcon size={20} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <div className={styles.handle} aria-hidden="true" />
              <header className={styles.header}>
                <h2 id={titleId}>{title}</h2>
                <IconButton label={de.common.close} icon={<CloseIcon />} onClick={onClose} />
              </header>
            </>
          )}
          <div className={styles.body}>
            {hero}
            {children}
          </div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

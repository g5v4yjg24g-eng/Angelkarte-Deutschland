import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { de } from '../../i18n/de';
import { dragOffset, shouldClose } from '../../lib/sheetDrag';
import { ChevronLeftIcon, CloseIcon } from '../icons';
import { IconButton } from './Button';
import { SunsetScene } from './SunsetScene';
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
  banner,
  returnFocus,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Kopfbild über dem Inhalt (ersetzt Griff und Kopfzeile); Zurück-Knopf liegt fest oben links */
  hero?: ReactNode;
  /** Kopfkarte mit Abendstimmung statt der einfachen Kopfzeile (z. B. Fang): Inhalt links, Schließen-Knopf rechts */
  banner?: ReactNode;
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

  // Nach unten ziehen schließt (Touch/Stift): das Blatt folgt dem Finger; im Inhalt nur, wenn er ganz oben steht
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    let start: { y: number; t: number } | undefined;
    let dy = 0;
    const set = (px: number, animate: boolean) => {
      el.style.transition = animate ? 'transform 200ms ease-out' : 'none';
      el.style.transform = px ? `translateY(${px}px)` : '';
    };
    const down = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      const body = el.querySelector<HTMLElement>(`.${styles.body}`);
      if (body?.contains(target) && body.scrollTop > 0) return;
      start = { y: e.touches[0]?.clientY ?? 0, t: performance.now() };
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      dy = (e.touches[0]?.clientY ?? 0) - start.y;
      if (dy > 0) {
        if (e.cancelable) e.preventDefault(); // Inhalt nicht mitscrollen, das Blatt folgt dem Finger
        set(dragOffset(dy), false);
      } else if (dy < -4) {
        start = undefined; // nach oben: normal scrollen
        set(0, false);
      }
    };
    const up = () => {
      if (!start) return;
      const speed = dy / Math.max(1, performance.now() - start.t);
      start = undefined;
      if (shouldClose(dy, speed, el.offsetHeight)) {
        set(el.offsetHeight, true);
        window.setTimeout(() => {
          set(0, false);
          onCloseRef.current();
        }, 200);
      } else set(0, true);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [open]);

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
        <div className={[styles.inner, hero ? styles.withHero : '', banner ? styles.withBanner : ''].join(' ')}>
          {hero ? (
            <>
              <h2 id={titleId} className="visually-hidden">
                {title}
              </h2>
              <button type="button" className={styles.back} aria-label={de.common.close} onClick={onClose}>
                <ChevronLeftIcon size={20} aria-hidden="true" />
              </button>
            </>
          ) : banner ? (
            <>
              <div className={styles.handle} aria-hidden="true" />
              <header className={styles.banner}>
                <SunsetScene />
                <h2 id={titleId} className="visually-hidden">
                  {title}
                </h2>
                <div className={styles.bannerContent}>{banner}</div>
                <button
                  type="button"
                  className={styles.bannerClose}
                  aria-label={de.common.close}
                  onClick={onClose}
                >
                  <CloseIcon size={22} aria-hidden="true" />
                </button>
              </header>
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

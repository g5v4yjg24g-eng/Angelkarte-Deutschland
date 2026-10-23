import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

/** Anzeigedauer mit Aktion (z. B. „Rückgängig") bzw. reine Info – beide 1,5 s (Wunsch Nutzer 2026-10-22).
 *  Liegt der Finger auf dem Hinweis, läuft die Zeit nicht weiter. */
export const TOAST_MS = 1500;
export const TOAST_INFO_MS = 1500;

/**
 * Kurzer Hinweis über der Leiste, angesagt über role="status". Mit `onDismiss` blendet er sich nach `duration`
 * selbst aus; solange Finger/Maus darauf liegt oder der Fokus darin ist, läuft die Zeit nicht (WCAG 2.2.1).
 * Ohne `onDismiss` bleibt er stehen (z. B. Update-Hinweis).
 */
export function Toast({
  children,
  actions,
  onDismiss,
  duration,
}: {
  children: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  duration?: number;
}) {
  const [held, setHeld] = useState(false);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  const ms = duration ?? (actions ? TOAST_MS : TOAST_INFO_MS);
  const auto = !!onDismiss;
  // Neuer Text startet die Zeit neu
  const key = typeof children === 'string' ? children : '';
  useEffect(() => {
    if (!auto || held) return;
    const t = setTimeout(() => dismiss.current?.(), ms);
    return () => clearTimeout(t);
  }, [auto, held, ms, key]);

  return (
    <div
      className={styles.toast}
      role="status"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <p className={styles.text}>{children}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

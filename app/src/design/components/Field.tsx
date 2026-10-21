import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './Field.module.css';

type Common = { label: string; hint?: string; error?: string | undefined };

/** Beschriftetes Eingabefeld mit Hinweis und Fehlertext (per aria-describedby verknüpft). */
export function TextField({ label, hint, error, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const desc = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={desc} aria-invalid={!!error || undefined} {...rest} />
      {hint && <small id={`${id}-h`}>{hint}</small>}
      {error && (
        <small id={`${id}-e`} className={styles.error}>
          {error}
        </small>
      )}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  error,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const desc = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={3} aria-describedby={desc} aria-invalid={!!error || undefined} {...rest} />
      {hint && <small id={`${id}-h`}>{hint}</small>}
      {error && (
        <small id={`${id}-e`} className={styles.error}>
          {error}
        </small>
      )}
    </div>
  );
}

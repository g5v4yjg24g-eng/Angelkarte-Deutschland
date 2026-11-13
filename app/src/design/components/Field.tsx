import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Field.module.css';

type Common = {
  label: string;
  hint?: string;
  error?: string | undefined;
  /** Beschriftung nur für Screenreader (die Überschrift steht schon darüber) */
  hideLabel?: boolean;
};

/** Beschriftetes Eingabefeld mit Hinweis und Fehlertext (per aria-describedby verknüpft). */
export function TextField({
  label,
  hint,
  error,
  hideLabel,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const desc = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
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
  hideLabel,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const desc = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
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

/** Auswahlliste (natives select: auf Mobilgeräten die gewohnte Systemauswahl). */
export function SelectField<T extends string>({
  label,
  hint,
  error,
  hideLabel,
  options,
  ...rest
}: Common & { options: readonly { value: T; label: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  const desc = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      <select id={id} aria-describedby={desc} aria-invalid={!!error || undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <small id={`${id}-h`}>{hint}</small>}
      {error && (
        <small id={`${id}-e`} className={styles.error}>
          {error}
        </small>
      )}
    </div>
  );
}

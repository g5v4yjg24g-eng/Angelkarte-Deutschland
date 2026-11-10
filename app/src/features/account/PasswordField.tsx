// Passwortfeld mit „anzeigen“ und (bei neuen Passwörtern) Stärke-Anzeige. autoComplete steuert den Schlüsselbund:
// „current-password“ füllt aus, „new-password“ schlägt ein starkes Passwort vor und speichert es (iPhone/Browser).
import { useId, useState, type InputHTMLAttributes } from 'react';
import { de } from '../../i18n/de';
import { passwordStrength } from '../../domain/account';
import fieldStyles from '../../design/components/Field.module.css';
import styles from './Account.module.css';

const t = de.account;

export function PasswordField({
  label,
  hint,
  error,
  value,
  onValue,
  isNew = false,
  email,
  ...rest
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  value: string;
  onValue: (v: string) => void;
  /** neues Passwort: Stärke zeigen und dem Schlüsselbund als neues Passwort melden */
  isNew?: boolean;
  email?: string | undefined;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const strength = isNew && value ? passwordStrength(value, email) : 0;
  const desc =
    [hint && `${id}-h`, error && `${id}-e`, isNew && value && `${id}-s`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={fieldStyles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.passwordRow}>
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={72}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          aria-describedby={desc}
          aria-invalid={!!error || undefined}
          {...rest}
        />
        <button
          type="button"
          className={styles.reveal}
          aria-pressed={shown}
          aria-label={t.revealLabel}
          onClick={() => setShown((v) => !v)}
        >
          {shown ? t.hidePassword : t.showPassword}
        </button>
      </div>
      {isNew && value && (
        <div id={`${id}-s`} className={styles.strength} data-level={strength}>
          <span className={styles.strengthBar} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {strength > 0 && <small>{t.strengthLabel(t.strength[strength])}</small>}
        </div>
      )}
      {hint && <small id={`${id}-h`}>{hint}</small>}
      {error && (
        <small id={`${id}-e`} className={fieldStyles.error}>
          {error}
        </small>
      )}
    </div>
  );
}

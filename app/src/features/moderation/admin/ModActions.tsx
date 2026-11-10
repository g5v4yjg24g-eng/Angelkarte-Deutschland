// Bestätigungsfenster für Moderations-Aktionen: Löschen, Verwarnen, Erledigt (mit Notiz), Sperren (Dauer + Grund),
// Sperre aufheben. Jede Aktion braucht eine bewusste Bestätigung.
import { useState, type FormEvent } from 'react';
import { de } from '../../../i18n/de';
import { Button } from '../../../design/components/Button';
import { TextArea } from '../../../design/components/Field';
import { Notice } from '../../../design/components/Notice';
import { Sheet } from '../../../design/components/Sheet';
import { BAN_DURATIONS, type BanDuration } from '../../../domain/modAdmin';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;

export type ModAction =
  | { kind: 'delete' }
  | { kind: 'avatar' }
  | { kind: 'profile' }
  | { kind: 'warn' }
  | { kind: 'resolve' }
  | { kind: 'ban'; name: string }
  | { kind: 'unban'; name: string };

export function ModActionSheet({
  action,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  action: ModAction | undefined;
  busy: boolean;
  error?: string | undefined;
  onCancel: () => void;
  /** note = Notiz bzw. Grund; days nur beim Sperren */
  onConfirm: (note: string, days?: BanDuration) => void;
}) {
  const [note, setNote] = useState('');
  const [days, setDays] = useState<BanDuration>(7);
  const title = !action
    ? ''
    : action.kind === 'delete'
      ? t.deleteTitle
      : action.kind === 'avatar'
        ? t.avatarTitle
        : action.kind === 'profile'
          ? t.profileTitle
          : action.kind === 'warn'
            ? t.warnTitle
            : action.kind === 'resolve'
              ? t.resolveTitle
              : action.kind === 'ban'
                ? t.banTitle(action.name)
                : t.unbanTitle(action.name);
  const text =
    action?.kind === 'delete'
      ? t.deleteText
      : action?.kind === 'avatar'
        ? t.avatarText
        : action?.kind === 'profile'
          ? t.profileText
          : action?.kind === 'warn'
            ? t.warnText
            : action?.kind === 'ban'
              ? t.banText
              : action?.kind === 'unban'
                ? t.unbanText
                : undefined;
  const ban = action?.kind === 'ban';
  const close = () => {
    setNote('');
    onCancel();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm(note.trim(), ban ? days : undefined);
  };

  return (
    <Sheet open={!!action} title={title} onClose={close}>
      <form className={styles.form} onSubmit={submit}>
        {text && <p>{text}</p>}
        {ban && (
          <fieldset className={styles.durations}>
            <legend>{t.duration}</legend>
            {BAN_DURATIONS.map((d) => (
              <label key={String(d)} className={styles.duration}>
                <input type="radio" name="days" checked={days === d} onChange={() => setDays(d)} />
                <span>{d === null ? t.durations.forever : t.durations[d]}</span>
              </label>
            ))}
          </fieldset>
        )}
        <TextArea
          label={ban ? t.banReason : t.note}
          value={note}
          maxLength={500}
          rows={3}
          required={ban}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            variant={
              action?.kind === 'delete' || action?.kind === 'avatar' || action?.kind === 'profile' || ban
                ? 'danger'
                : 'primary'
            }
            disabled={busy || (ban && !note.trim())}
          >
            {t.confirm}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

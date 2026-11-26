// Erinnerung je Termin (nur iPhone-App): 1 Tag, 3 Stunden und/oder 1 Stunde vorher. Ohne eigene Wahl gelten die
// Zeiten aus den Einstellungen; die erste Änderung legt sie für diesen Termin fest.
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Switch } from '../../design/components/Switch';
import { getSetting } from '../../data/settings';
import { normalizeOffsets, type TripRemindOffset } from '../../domain/tripReminders';
import styles from './CalendarPage.module.css';

const ROWS: readonly { key: TripRemindOffset; label: string }[] = [
  { key: 'day', label: de.settings.tripReminderDay },
  { key: 'h3', label: de.settings.tripReminderH3 },
  { key: 'h1', label: de.settings.tripReminderH1 },
];

export function TripReminderPicker({
  value,
  onChange,
}: {
  value: TripRemindOffset[] | undefined;
  onChange: (next: TripRemindOffset[]) => void;
}) {
  const fallback = useLiveQuery(async () => normalizeOffsets(await getSetting('tripReminders')), []);
  const current = value ?? fallback;
  if (!current) return null;
  const toggle = (key: TripRemindOffset, on: boolean) =>
    onChange(ROWS.map((r) => r.key).filter((k) => (k === key ? on : current.includes(k))));
  return (
    <fieldset className={styles.invite}>
      <legend>{de.calendar.remindTitle}</legend>
      {ROWS.map((r) => (
        <div key={r.key} className={styles.remindRow}>
          <span>{r.label}</span>
          <Switch label={r.label} checked={current.includes(r.key)} onChange={(on) => toggle(r.key, on)} />
        </div>
      ))}
    </fieldset>
  );
}

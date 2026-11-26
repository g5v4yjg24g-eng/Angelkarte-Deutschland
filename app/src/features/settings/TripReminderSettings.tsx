// Wann vor einem Angeltermin erinnert wird (nur iPhone-App): 1 Tag, 3 Stunden und/oder 1 Stunde vorher.
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { Switch } from '../../design/components/Switch';
import { getSetting, setSetting } from '../../data/settings';
import { normalizeOffsets, type TripRemindOffset } from '../../domain/tripReminders';
import { useProviders } from '../../ports/providersContext';
import styles from './TripReminderSettings.module.css';

const ROWS: readonly { key: TripRemindOffset; label: string }[] = [
  { key: 'day', label: de.settings.tripReminderDay },
  { key: 'h3', label: de.settings.tripReminderH3 },
  { key: 'h1', label: de.settings.tripReminderH1 },
];

export function TripReminderSettings() {
  const { reminders } = useProviders();
  const offsets = useLiveQuery(async () => normalizeOffsets(await getSetting('tripReminders')), []);
  if (!reminders || !offsets) return null;
  const toggle = (key: TripRemindOffset, on: boolean) => {
    const next = on ? [...offsets, key] : offsets.filter((o) => o !== key);
    void setSetting('tripReminders', next);
  };
  return (
    <Section title={de.settings.tripReminders}>
      <ul className={styles.list}>
        {ROWS.map((r) => (
          <li key={r.key} className={styles.row}>
            <span>{r.label}</span>
            <Switch label={r.label} checked={offsets.includes(r.key)} onChange={(on) => toggle(r.key, on)} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

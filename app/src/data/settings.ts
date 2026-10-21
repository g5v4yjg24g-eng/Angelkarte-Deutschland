import { getDb, type FangpunktDB } from './db';

/** Typisierte Einstellungen (DATA_MODEL §5.6). */
export interface Settings {
  lastBackupAt: string;
  backupReminderSnoozedUntil: string;
  persistRequested: boolean;
}

export async function getSetting<K extends keyof Settings>(
  key: K,
  db: FangpunktDB = getDb(),
): Promise<Settings[K] | undefined> {
  return (await db.settings.get(key))?.value as Settings[K] | undefined;
}
export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
  db: FangpunktDB = getDb(),
) {
  await db.settings.put({ key, value });
}

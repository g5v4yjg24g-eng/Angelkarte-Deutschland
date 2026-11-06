import { getDb, type FangpunktDB } from './db';

/** Typisierte Einstellungen (DATA_MODEL §5.6). */
export interface Settings {
  lastBackupAt: string;
  backupReminderSnoozedUntil: string;
  persistRequested: boolean;
  /** Wetter zu Fängen laden (sendet gerundete Koordinaten an den Wetterdienst); Standard: an */
  weatherEnabled: boolean;
  /** Standort beim Öffnen der Karte anzeigen (bleibt auf dem Gerät); Standard: an */
  locateOnStart: boolean;
  /** Route laufender Sessions aufzeichnen (bleibt auf dem Gerät); Standard: an */
  trackSessions: boolean;
  /** Anonyme Nutzungszählung (GoatCounter, nur Bereichspfade); Standard: an (Entscheidung Nutzer 2026-10-24) */
  usageCount: boolean;
  /** Vibration bei Speichern, „Gefällt mir“ und Wischen über die Leiste (nur iPhone-App); Standard: an */
  haptics: boolean;
  /** Erreichte Erfolgs-Stufen (Schlüssel → Datum); Variante A: werden nie entfernt */
  achievements: Record<string, string>;
  /** Neu erreichte, noch nicht angesehene Stufen (bis die Erfolge-Übersicht geöffnet wird) */
  achievementsNew: string[];
  /** ID des zuletzt gesehenen Neuigkeiten-Eintrags (Fenster „Neu in Fangpunkt“) */
  lastSeenChangelog: string;
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

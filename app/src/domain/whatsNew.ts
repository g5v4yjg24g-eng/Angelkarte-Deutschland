// „Neu in Fangpunkt“ (Wunsch Nutzer 2026-10-25): Nach einem Update sieht jede Person einmal, was neu ist.
// Rein: welche Einträge sind ungesehen? Einträge stehen neuester zuerst; IDs sind sortierbar (JJJJ-MM-TT, ggf. -2).
export interface ChangelogEntry {
  id: string;
  title: string;
  items: string[];
}

/** Sortierschlüssel: der Zähler hinter dem Datum zählt als Zahl (-10 kommt nach -9). */
export function idKey(id: string): string {
  const [, d = '', n = '0'] = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/.exec(id) ?? [];
  return `${d}#${n.padStart(6, '0')}`;
}

export const latestId = (entries: readonly ChangelogEntry[]) => entries[0]?.id;

/**
 * Ungesehene Einträge. Ohne gemerkten Stand: neue Installation → nichts (alles ist neu, kein Fenster);
 * wer schon Daten hat, nutzt die App seit vor dieser Funktion → nur der neueste Eintrag.
 */
export function unseenEntries(
  entries: readonly ChangelogEntry[],
  lastSeen: string | undefined,
  hasData: boolean,
): ChangelogEntry[] {
  if (lastSeen === undefined) return hasData ? entries.slice(0, 1) : [];
  const seen = idKey(lastSeen);
  return entries.filter((e) => idKey(e.id) > seen);
}

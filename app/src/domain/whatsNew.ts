// „Neu in Fangpunkt“ (Wunsch Nutzer 2026-10-25): Nach einem Update sieht jede Person einmal, was neu ist.
// Rein: welche Einträge sind ungesehen? Einträge stehen neuester zuerst; IDs sind sortierbar (JJJJ-MM-TT, ggf. -2).
export interface ChangelogEntry {
  id: string;
  title: string;
  items: string[];
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
  return entries.filter((e) => e.id > lastSeen);
}

// Anleitung (Wunsch Nutzer 2026-11-15): Kurztour für neue Nutzer, nachlesbar unter Mehr und in den Einstellungen.
// Rein: welche Themen es gibt, wie sie gruppiert sind, wer das Willkommensblatt sieht und wie man durch die Tour geht.
export const GUIDE_IDS = [
  'map',
  'catch',
  'book',
  'sessions',
  'weather',
  'law',
  'papers',
  'knots',
  'community',
  'backup',
] as const;
export type GuideId = (typeof GUIDE_IDS)[number];

/** Schritte der Kurztour: nur die Angel-Funktionen, in der Reihenfolge eines Angeltags */
export const TOUR: readonly GuideId[] = ['map', 'catch', 'book', 'sessions', 'weather', 'law', 'knots'];

export const GROUP_IDS = ['start', 'review', 'plan', 'learn', 'more'] as const;
export type GroupId = (typeof GROUP_IDS)[number];
export const GROUPS: readonly { id: GroupId; topics: readonly GuideId[] }[] = [
  { id: 'start', topics: ['map', 'catch'] },
  { id: 'review', topics: ['book', 'sessions'] },
  { id: 'plan', topics: ['weather', 'law', 'papers'] },
  { id: 'learn', topics: ['knots'] },
  { id: 'more', topics: ['community', 'backup'] },
];

/** Bei einer Änderung der Tour erhöhen, wenn alle sie noch einmal angeboten bekommen sollen (bisher nie nötig) */
export const GUIDE_VERSION = 1;

/**
 * Willkommensblatt nur bei neuer Installation: noch nichts gesehen und noch keine eigenen Daten. Wer die App schon
 * nutzt, bekommt kein Fenster – er findet die Anleitung unter Mehr und in den Einstellungen.
 */
export const shouldOfferWelcome = (seen: number | undefined, hasData: boolean) =>
  seen === undefined && !hasData;

/** Bestehende Nutzer ohne Stand: still als gesehen merken, damit später nie ein Fenster auftaucht */
export const shouldMarkSilently = (seen: number | undefined, hasData: boolean) =>
  seen === undefined && hasData;

export const clampStep = (i: number, count: number) => Math.max(0, Math.min(count - 1, i));
export const isLastStep = (i: number, count: number) => i >= count - 1;

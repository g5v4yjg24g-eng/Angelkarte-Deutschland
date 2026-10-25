// Neuigkeiten für das Fenster „Neu in Fangpunkt“ – neuester Eintrag zuerst. Bei jeder für Nutzer sichtbaren neuen
// Funktion einen Eintrag ergänzen (CLAUDE.md). ID = Datum der Veröffentlichung (JJJJ-MM-TT, am selben Tag -2 usw.).
import type { ChangelogEntry } from '../domain/whatsNew';

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: '2026-10-25',
    title: 'Oktober 2026',
    items: [
      'Session-Rückblick: Während einer Session zeichnet Fangpunkt deinen Weg auf (solange die App offen ist). Nach dem Beenden siehst du die Route als Animation auf der Karte, mit deinen Fängen, Highlights und einer Chronik.',
      'Wetter schon beim Erfassen: Unter „Mehr Details“ siehst du das Wetter am Fangort und kannst es in die Felder übernehmen.',
      'Pegel am Fang: Der Wasserstand am nächsten Pegel wird zum Fang gespeichert; in den Beißfenstern gibt es „Bisse nach Pegellage“.',
      'Karte: Sie bleibt nach einem Seitenwechsel, wo du sie verlassen hast. Neuer Knopf „Zu meinem Standort“.',
      'Neue Fischarten: Lachs, Meerforelle und Stör.',
      'Anonyme Nutzungszählung: Gezählt wird nur, welche Bereiche geöffnet werden – abschaltbar in den Einstellungen.',
    ],
  },
];

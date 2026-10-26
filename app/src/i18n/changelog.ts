// Neuigkeiten für das Fenster „Neu in Fangpunkt“ – neuester Eintrag zuerst. Bei jeder für Nutzer sichtbaren neuen
// Funktion einen Eintrag ergänzen (CLAUDE.md). ID = Datum der Veröffentlichung (JJJJ-MM-TT, am selben Tag -2 usw.).
import type { ChangelogEntry } from '../domain/whatsNew';

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: '2026-10-25-8',
    title: 'Konto',
    items: [
      'Konto (demnächst): Unter Mehr → Konto entsteht ein freiwilliges Konto, mit dem du bald Freunde hinzufügen kannst. Fangbuch, Fotos und Angelstellen bleiben weiter nur auf deinem Gerät.',
    ],
  },
  {
    id: '2026-10-25-7',
    title: 'Alle Knoten animiert',
    items: [
      'Knoten: Jetzt zeigen alle neun Knoten Schritt für Schritt, wie die Schnur läuft – neu sind Doppelter Uni-Knoten, FG-Knoten, Chirurgenknoten, Perfection Loop, Spulenknoten und Snell-Knoten. Bei Verbindungsknoten ist das Vorfach orange.',
    ],
  },
  {
    id: '2026-10-25-6',
    title: 'Knoten',
    items: [
      'Knoten: Unter Mehr → Knoten findest du die wichtigsten Angelknoten mit Einsatzzweck. Clinch-, Palomar- und Uni-Knoten zeigen Schritt für Schritt als Animation, wie die Schnur läuft – weitere folgen.',
    ],
  },
  {
    id: '2026-10-25-5',
    title: 'Gewässerkarten in NRW',
    items: [
      'Gewässerkarten in NRW: Für 20 Seen und Talsperren – z. B. Möhne-, Bigge-, Sorpe- und Rurtalsperre, Baldeneysee, Bever- und Wuppertalsperre – führt die Gewässerkarte direkt zur Seite des Verbands oder Betreibers.',
    ],
  },
  {
    id: '2026-10-25-4',
    title: 'Gewässerkarte',
    items: [
      'Gewässerkarte: Tippe auf ein Gewässer – unter „Gewässerkarte“ siehst du, wo es die Angelkarte gibt. Bei geprüften Gewässern führt „Zur Angelkarten-Seite“ direkt zum Verein, Verband oder Betreiber, sonst zur Angelkarten-Seite des Landesverbands.',
      'Eigener Link: Kennst du die Seite deines Vereins, speichere sie am Gewässer. Der Link bleibt auf deinem Gerät und ist Teil deiner Sicherung.',
    ],
  },
  {
    id: '2026-10-25-3',
    title: 'Suche im Angelrecht',
    items: [
      'Fischart suchen: In jedem Bundesland unter Mehr → Angelrecht findest du eine Art schnell über das Suchfeld (auch mit wissenschaftlichem Namen oder z. B. „Waller“).',
      'Nur Fische in der Schonzeit: Ein Knopf zeigt nur die Arten, die heute Schonzeit haben – mit ihren Maßen und den ganzjährig geschonten Arten.',
    ],
  },
  {
    id: '2026-10-25-2',
    title: 'Angelrecht NRW',
    items: [
      'Angelrecht NRW: Schonzeiten, Mindestmaße, ganzjährig geschützte Arten und die Regeln zu Fischereischein, Fischereiabgabe und Erlaubnisschein – aus dem amtlichen Text (Landesfischereigesetz und -verordnung, Stand Juli 2026).',
      'Warnung beim Erfassen jetzt auch in NRW: Liegt ein Fang in der Schonzeit oder unter dem Mindestmaß, weist Fangpunkt darauf hin. Keine Rechtsauskunft.',
    ],
  },
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

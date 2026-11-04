// Neuigkeiten für das Fenster „Neu in Fangpunkt“ – neuester Eintrag zuerst. Bei jeder für Nutzer sichtbaren neuen
// Funktion einen Eintrag ergänzen (CLAUDE.md). ID = Datum der Veröffentlichung (JJJJ-MM-TT, am selben Tag -2 usw.).
import type { ChangelogEntry } from '../domain/whatsNew';

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: '2026-11-08',
    title: 'Melden und Blockieren',
    items: [
      'Melden: Über „…“ an Beiträgen im Feed, geteilten Spots und Freunden meldest du Inhalte, die gegen die Regeln verstoßen. Wir prüfen jede Meldung innerhalb von 24 Stunden.',
      'Blockieren: Blockierte Personen sehen deine Beiträge und Spots nicht mehr und können dir keine Anfragen schicken. Aufheben unter Profil → Freunde → Blockiert.',
      'Regeln der Community: Vor dem ersten Anmeldecode bestätigst du die Regeln. Nachlesen über den Link unter Mehr → Konto.',
    ],
  },
  {
    id: '2026-11-07',
    title: 'Spots teilen',
    items: [
      'Spots teilen: Tippe auf der Karte auf einen deiner Orte und dann auf „Teilen“ – mit allen Freunden oder einem ausgewählten Freund, mit genauer Position.',
      'Geteilte Spots: Spots deiner Freunde erscheinen als violette Pins auf der Karte und unter Profil → Geteilte Spots. Mit „In meine Orte übernehmen“ landen sie bei deinen eigenen Orten.',
    ],
  },
  {
    id: '2026-11-06',
    title: 'Feed',
    items: [
      'Feed: Neuer Punkt in der unteren Leiste – hier siehst du die geteilten Beiträge deiner Freunde und deine eigenen, neueste zuerst.',
    ],
  },
  {
    id: '2026-11-05',
    title: 'Beiträge teilen',
    items: [
      'Beiträge teilen: Bist du angemeldet, wird ein neuer Beitrag mit Fotos und Text geteilt – sichtbar für deine Freunde oder für alle. Ältere Beiträge teilst du über „Teilen“, zurücknehmen geht mit „Nicht mehr teilen“.',
    ],
  },
  {
    id: '2026-11-04',
    title: 'Freunde',
    items: [
      'Freunde: Im Profil unter „Freunde hinzufügen“ schickst du Anfragen über den Nutzernamen, nimmst Anfragen an oder lehnst sie ab. Dafür brauchst du ein Konto (Mehr → Konto).',
    ],
  },
  {
    id: '2026-11-03',
    title: 'Konto',
    items: [
      'Konto: Unter Mehr → Konto kannst du jetzt freiwillig ein Konto mit Nutzernamen anlegen – angemeldet wird mit einem Code per E-Mail, ohne Passwort. Fangbuch, Fotos und Angelstellen bleiben weiter nur auf deinem Gerät.',
    ],
  },
  {
    id: '2026-10-30',
    title: 'Solunar im Tagesdetail',
    items: [
      'Wetter: Im Tagesdetail stehen jetzt auch die Solunar-Zeiten des Tages – als Leiste über den Tag, mit Haupt- und Nebenzeiten und der Mondphase (Theorie, wissenschaftlich nicht belegt).',
      'Beißfenster: Die lange Solunar-Liste unten auf der Wetter-Seite ist weg – die Zeiten findest du jetzt beim jeweiligen Tag.',
    ],
  },
  {
    id: '2026-10-28',
    title: 'Neues Wetter',
    items: [
      'Wetter: Neu gestaltet – mit großer Temperatur, Stundenleiste samt Sonnenauf- und -untergang und einer 10-Tage-Vorhersage mit Temperaturbalken.',
      'Tagesdetail: Tippe auf einen Tag – dann siehst du Temperatur (tatsächlich und gefühlt), Regenwahrscheinlichkeit, Wind und Luftdruck über den Tag.',
    ],
  },
  {
    id: '2026-10-27-4',
    title: 'Köderführung',
    items: [
      'Köderführung: Unter Mehr → Knoten, Montagen & Köderführung zeigen acht Techniken wie Jiggen, Faulenzen, Twitchen und Jerken, wie du deinen Köder führst – mit Animation, in der du siehst, wie die Rute geführt wird und wie der Köder dabei unter Wasser schwimmt, und mit Erklärung, wofür sie gut sind.',
    ],
  },
  {
    id: '2026-10-27-3',
    title: 'Gefällt mir und Kommentare',
    items: [
      'Gefällt mir: Tippe unter einem Beitrag auf den Daumen – oder tippe zweimal schnell aufs Foto.',
      'Kommentare: „Kommentieren“ öffnet ein Fenster von unten – zum Schließen einfach herunterziehen. Vorerst sind „Gefällt mir“ und Kommentare nur deine eigenen; mit dem Konto können Freunde mitmachen.',
      'Sichtbarkeit: Beim Posten wählst du „Freunde“ oder „Alle“ – das gilt, sobald es Konten gibt.',
    ],
  },
  {
    id: '2026-10-27-2',
    title: 'Profil',
    items: [
      'Profil: In der Mitte der unteren Leiste wartet jetzt dein Profil – mit Profilbild, Name, ein paar Worten über dich und deinen Beiträgen als Fotoraster.',
      'Beiträge: Poste Fotos mit Text, auf Wunsch verknüpft mit einem Fang – auch direkt aus dem Fangbuch über „Im Profil posten“. Alles bleibt vorerst auf deinem Gerät.',
      'Statistik: Sie ist jetzt ein Reiter im Fangbuch (Einträge | Statistik).',
    ],
  },
  {
    id: '2026-10-27',
    title: 'Montagen',
    items: [
      'Montagen: Unter Mehr → Knoten & Montagen findest du jetzt acht bewährte Montagen – vom Carolina-Rig bis zur Laufpose. Jede zeigt Schritt für Schritt, wie sie aufgebaut wird, und erklärt, wofür sie gut ist.',
    ],
  },
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

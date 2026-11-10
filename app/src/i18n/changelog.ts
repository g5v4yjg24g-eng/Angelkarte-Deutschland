// Neuigkeiten für das Fenster „Neu in Fangpunkt“ – neuester Eintrag zuerst. Bei jeder für Nutzer sichtbaren neuen
// Funktion einen Eintrag ergänzen (CLAUDE.md). ID = Datum der Veröffentlichung (JJJJ-MM-TT, am selben Tag -2 usw.).
import type { ChangelogEntry } from '../domain/whatsNew';

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: '2026-12-06',
    title: 'Feed und Profile',
    items: [
      'Feed: Alle Beiträge haben jetzt dieselbe Größe (Hochformat). Beim Scrollen verschieben sich die Fotos nicht mehr – zum nächsten Foto wischst du zur Seite.',
      'Profilbild: Das kleine runde Bild ist nicht mehr verzerrt. Ein Tipp darauf öffnet – wie der Name – das Profil.',
      'Profile anderer: Sehen jetzt aus wie dein eigenes, mit Zahlen oben und den Beiträgen als Kacheln. Ein Tipp auf eine Kachel öffnet die Beiträge zum Durchscrollen.',
    ],
  },
  {
    id: '2026-12-05',
    title: 'Anmeldung mit Passwort',
    items: [
      'Konto: Du meldest dich jetzt mit E-Mail-Adresse und Passwort an. Neue Konten bestätigst du per Link oder Code aus der E-Mail.',
      'Bisheriges Konto: Lege unter Mehr → Konto ein Passwort fest – oder nutze „Passwort vergessen?“. Profil, Beiträge und Freunde bleiben.',
      'Sicherheit: Passwort ändern, E-Mail-Adresse ändern und „Auf allen anderen Geräten abmelden“ findest du unter Mehr → Konto.',
      'iPhone: Dein Passwort kann im Schlüsselbund gespeichert und per Face ID ausgefüllt werden.',
    ],
  },
  {
    id: '2026-12-04',
    title: 'Beiträge sicher auf dem Server',
    items: [
      'Beiträge: Mit Konto werden alle deine Beiträge jetzt automatisch auf dem Server gesichert – auch ältere. Freunde sehen sie im Feed, „Alle“ erscheinen unter Entdecken.',
      'Sichtbarkeit: Neu ist „Nur ich“ – der Beitrag ist gesichert, aber nur für dich sichtbar.',
      'Mehrere Geräte: Dein Profil zeigt auf jedem Gerät deine Beiträge.',
      'Stand: Am Beitrag und unter Einstellungen siehst du, ob alles gesichert ist. Klappt es nicht, versucht Fangpunkt es automatisch erneut.',
    ],
  },
  {
    id: '2026-12-03',
    title: 'Mehr Mitteilungen',
    items: [
      'Mitteilungen: Neu auch bei neuen Beiträgen von Freunden, weiteren Kommentaren unter Beiträgen, die du kommentiert hast, sowie Zusagen und Highlights in gemeinsamen Sessions.',
      'Einstellungen: Unter Mitteilungen siehst du, ob dein iPhone angemeldet ist, und kannst eine Test-Mitteilung senden.',
    ],
  },
  {
    id: '2026-12-02-3',
    title: 'Beiträge wie bei Instagram',
    items: [
      'Beiträge: Fischart und Länge stehen jetzt direkt unter deinem Namen – im Profil und im Feed.',
      'Profil: Tippst du auf ein Bild, kannst du nach unten weiterscrollen und siehst deine nächsten Beiträge.',
      'Optionen: Bearbeiten, Anheften, Teilen und Löschen findest du über „⋯“ rechts neben dem Namen. Unter dem Bild bleibt es aufgeräumt.',
    ],
  },
  {
    id: '2026-12-02-2',
    title: 'Beiträge teilen',
    items: [
      'Profil: Liegen Beiträge noch nur auf deinem Gerät (z. B. von vor der Anmeldung), zeigt das Profil einen Hinweis mit „Alle teilen“.',
      'Beitrag: Klappt das Teilen nicht, siehst du das jetzt und kannst es erneut versuchen.',
    ],
  },
  {
    id: '2026-12-02',
    title: 'Profil teilen',
    items: [
      'Profil: „Profil teilen“ schickt einen Link zu deinem Profil, z. B. per WhatsApp. Im Link steht nur dein Nutzername.',
      'iPhone-App: Tippt jemand mit Fangpunkt auf den Link, öffnet sich dein Profil direkt in der App – mit „Freund hinzufügen“.',
    ],
  },
  {
    id: '2026-12-01',
    title: 'Freunde finden und Profile ansehen',
    items: [
      'Suche: Unter Profil → Freunde findest du andere über Nutzername oder Namen (ab 3 Zeichen).',
      'Profile: Tippe auf einen Namen im Feed oder in der Freundesliste. Freunde sehen deinen Profiltext, Lieblingsfische, Methoden, Region und deine angehefteten Beiträge – Fremde nicht.',
      'Sessions: „Zusammenfassung teilen“ macht aus einer beendeten Session einen Beitrag mit Angelzeit, Fängen und Arten – ohne Route, Koordinaten oder Gewässernamen.',
    ],
  },
  {
    id: '2026-11-30',
    title: 'Route im Hintergrund',
    items: [
      'iPhone-App: Während einer laufenden Session wird deine Route jetzt auch bei gesperrtem Bildschirm aufgezeichnet. iOS zeigt das mit der blauen Standort-Anzeige; Pause oder Ende halten die Aufzeichnung an. Die Route bleibt auf deinem Gerät.',
    ],
  },
  {
    id: '2026-11-29',
    title: 'Profil erweitern',
    items: [
      'Profil: Lieblingsfische, bevorzugte Methoden und deine Region (nur das Bundesland) kannst du jetzt freiwillig angeben.',
      'Highlights: Bis zu drei Beiträge lassen sich oben im Profil anheften.',
    ],
  },
  {
    id: '2026-11-28',
    title: 'Teilen',
    items: [
      'Beiträge: Deine eigenen Beiträge kannst du über das Teilen-Symbol weitergeben – mit Fotos und Text, nie mit dem Fangort.',
      'iPhone-App: Sicherung, CSV-Export und Kalenderdatei öffnen das Teilen-Menü, z. B. „In Dateien sichern“.',
    ],
  },
  {
    id: '2026-11-27',
    title: 'Kleine Verbesserungen',
    items: [
      'Session-Rückblick: Der Knopf zum Schließen bleibt beim Scrollen oben rechts sichtbar.',
      'Suche: Ist auf deinem Gerät „Bewegung reduzieren“ eingeschaltet, springt die Karte direkt zum Treffer statt zu fliegen.',
    ],
  },
  {
    id: '2026-11-26',
    title: 'Eigene Gewässerregeln',
    items: [
      'Gewässerprofil: Trag die Regeln von deinem Erlaubnisschein ein, z. B. Mindestmaße oder Nachtangelverbot. Sie bleiben auf deinem Gerät und stehen beim Erfassen eines Fangs an diesem Gewässer neben dem Landesrecht – als deine Notiz, nicht von Fangpunkt geprüft.',
      'Landesrecht beim Fang: Liegt das Gewässer laut Kartendaten in einem anderen Bundesland als der Fangpunkt, fragt Fangpunkt nach, welches Landesrecht gilt.',
    ],
  },
  {
    id: '2026-11-25',
    title: 'Highlights gemeinsamer Sessions',
    items: [
      'Gemeinsam angeln: Teile einen Fang der Session als Highlight – Fang öffnen, „Posten“, Haken bei „Als Highlight teilen“. Sehen können es nur die Teilnehmer, im Feed und in der Session.',
      'In der Session stehen jetzt alle Highlights und wie viele dabei waren.',
    ],
  },
  {
    id: '2026-11-24',
    title: 'Gemeinsam angeln',
    items: [
      'Sessions: Lade während einer Session Freunde ein – höchstens 10 Personen sind gemeinsam dabei. Eingeladene sagen unter Fangbuch → Sessions zu oder ab und bekommen eine eigene Session.',
      'Geteilt wird nur, wer dabei ist (und auf Wunsch der Gewässername). Positionen, Routen und Fänge bleiben auf deinem Gerät.',
    ],
  },
  {
    id: '2026-11-23',
    title: 'Entdecken',
    items: [
      'Feed: Neuer Reiter „Entdecken“ mit Beiträgen, die andere für alle sichtbar teilen – zuletzt geteilt zuerst. Blockierte Personen erscheinen dort nicht.',
      'Beiträge: Wählst du beim Posten „Alle“, kann den Beitrag jeder mit Fangpunkt-Konto sehen. Gegen Spam gehen höchstens 20 neue Beiträge in 24 Stunden.',
    ],
  },
  {
    id: '2026-11-22',
    title: 'Beiträge speichern',
    items: [
      'Feed: Mit dem Lesezeichen rechts unter einem Beitrag speicherst du ihn. Wiederfinden unter Profil → Gespeichert. Nur du siehst, was du gespeichert hast.',
    ],
  },
  {
    id: '2026-11-21',
    title: 'Fischart und Länge am Beitrag',
    items: [
      'Beiträge: Fischart und Länge lassen sich jetzt freiwillig angeben – beim Posten aus einem Fang sind sie schon ausgefüllt. Im Feed steht dann z. B. „Hecht · 87 cm“. Der Fangort wird nie geteilt.',
    ],
  },
  {
    id: '2026-11-20',
    title: 'Erfolge',
    items: [
      'Profil: Neue Erfolge in Bronze, Silber und Gold – für Fänge, Fischarten, Gewässer, Sessions, Hecht, Zander und Großfisch, dazu „Erster Fang“. Unter „Alle ansehen“ siehst du, was zur nächsten Stufe fehlt.',
      'Berechnet aus deinem Fangbuch auf dem Gerät. Eine erreichte Stufe bleibt, auch wenn du später Einträge löschst.',
    ],
  },
  {
    id: '2026-11-19',
    title: 'Beißprognose',
    items: [
      'Wetter: Jeder Tag der Vorhersage zeigt jetzt „günstig“, „mittel“ oder „schwierig“. Im Tagesdetail stehen die Gründe – Luftdruck-Verlauf, Wind, Bewölkung, Regen, Temperatur – und die Dämmerungszeiten.',
      'Das ist eine Faustregel, keine Fanggarantie. Bei Gewitter oder Sturm gibt es zusätzlich einen Sicherheitshinweis.',
    ],
  },
  {
    id: '2026-11-18',
    title: 'Kartenfilter',
    items: [
      'Karte: Unter „Ebenen & Legende“ blendest du Fänge, Fischkontakte, Fehlbisse, Beobachtungen, deine Orte und Spots von Freunden einzeln aus und ein. Die Auswahl merkt sich dein Gerät; ist etwas ausgeblendet, ist der Knopf hervorgehoben.',
    ],
  },
  {
    id: '2026-11-17',
    title: '„Mehr“ übersichtlicher',
    items: [
      'Mehr: Die Bereiche stehen jetzt in Gruppen – Planen & Lernen, Recht & Regeln, Konto & Daten, App. Neu dort: der Angelkalender und die Regeln der Community.',
    ],
  },
  {
    id: '2026-11-16',
    title: 'Hecht beim Doppeltipp',
    items: [
      'Gefällt mir: Tippst du zweimal auf ein Foto im Feed oder in deinem Beitrag, schwimmt ein kleiner Hecht durchs Bild zum Daumen – und der Beitrag gefällt dir.',
      'Ein Doppeltipp nimmt „Gefällt mir“ nie zurück. Bei reduzierter Bewegung wechselt nur der Daumen.',
    ],
  },
  {
    id: '2026-11-15',
    title: 'Profilbilder für Freunde',
    items: [
      'Profilbild: Bist du angemeldet, sehen deine Freunde dein Bild jetzt im Feed, bei Kommentaren und in der Freundesliste – und du ihres.',
      'Ändern oder Entfernen wirkt auch dort; das alte Bild wird ersetzt bzw. gelöscht.',
    ],
  },
  {
    id: '2026-11-14',
    title: 'Profilbild zuschneiden',
    items: [
      'Profilbild: Nach der Auswahl schiebst und zoomst du dein Bild im Kreis zurecht – mit dem Finger, zwei Fingern oder dem Regler. Gespeichert wird genau dieser Ausschnitt, ohne Standortdaten.',
    ],
  },
  {
    id: '2026-11-13',
    title: 'iPhone-App fühlt sich nativer an',
    items: [
      'iPhone-App: Die Oberfläche federt nicht mehr nach, zoomt nicht ungewollt und markiert keinen Text mehr – die Karte lässt sich wie gewohnt verschieben und zoomen.',
      'Tastatur: Die Ansicht schiebt sich nicht mehr nach oben, die untere Leiste macht beim Tippen Platz.',
      'Vibration: Kurzes Feedback beim Speichern eines Fangs, bei „Gefällt mir“ und beim Wischen über die Leiste – abschaltbar unter Einstellungen.',
    ],
  },
  {
    id: '2026-11-12',
    title: 'Gewässer übersichtlicher',
    items: [
      'Gewässer: Antippen zeigt oben das Wichtigste – Art, Lage, Fläche, deine Orte und Fänge und „Hier markieren“. Darunter „Angeln hier“ mit Landesrecht und Gewässerkarte; weitere Angaben zum Aufklappen.',
    ],
  },
  {
    id: '2026-11-11',
    title: 'Wetter im Fangpunkt-Look',
    items: [
      'Wetter: Die Vorhersage hat jetzt die Farben von Fangpunkt – hell wie dunkel passend zum Rest der App.',
    ],
  },
  {
    id: '2026-11-10',
    title: 'Mitteilungen in der iPhone-App',
    items: [
      'Mitteilungen: In der iPhone-App bekommst du eine Mitteilung bei Freundschaftsanfragen, „Gefällt mir“, Kommentaren und geteilten Spots. Antippen öffnet die passende Stelle.',
      'Einstellungen: Unter Mehr → Einstellungen → Mitteilungen schaltest du jede Art einzeln ab.',
    ],
  },
  {
    id: '2026-11-09',
    title: 'Gefällt mir und Kommentare mit Freunden',
    items: [
      'Feed: Unter jedem Beitrag kannst du jetzt „Gefällt mir“ geben und kommentieren – deine Freunde sehen es.',
      'Eigene Beiträge: Ist ein Beitrag geteilt, siehst du, wem er gefällt und was deine Freunde schreiben. Unpassende Kommentare kannst du unter deinem Beitrag löschen oder melden.',
    ],
  },
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

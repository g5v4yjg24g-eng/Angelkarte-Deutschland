# TEST_PLAN – Teststrategie und Abnahmekriterien

Stand: 2026-10-21 · Entwurf

## 1. Testebenen

| Ebene | Werkzeug | Gegenstand | Läuft |
|---|---|---|---|
| Typprüfung | `tsc --noEmit` (strict) | gesamter Code | jeder Commit (CI) |
| Lint | ESLint inkl. Schichtregeln (`domain` ohne UI-Imports) | gesamter Code | CI |
| Unit | Vitest | `domain/` (Statistik, Schonzeit-Logik, Zeitzonen, Geo, Validierung), Migrationen, Import-Upgrader | CI |
| Integration | Vitest + `fake-indexeddb` | Repositories, Export/Import-Roundtrip, Transaktionen, Quota-Fehler | CI |
| Komponenten | Vitest + Testing Library | Formulare, leere Zustände, Fehlermeldungen | CI |
| E2E | Playwright Test (Chromium, WebKit, Firefox) | Kernabläufe, Offline, PWA-Update | CI (Chromium); vor Release alle drei |
| Barrierefreiheit | `@axe-core/playwright` + manuelle Checks | alle Hauptansichten | CI + Release |
| Performance | Lighthouse CI | App-Shell, Karte | CI (Budget) |
| Daten | `tools/validate-data` | `data/regulations/*.json`, Pipeline-Ausgaben | CI |
| Geräte | manuell nach Checkliste §5 | echte Geräte | jeder Meilenstein |

Netzwerk in E2E: Externe Dienste (Karte, Wetter) werden per `page.route` **gemockt** bzw. mit Fixture-Kacheln bedient. Tests dürfen keine öffentlichen Dienste belasten.

## 2. Testdaten

- `tests/fixtures/`: Datensätze mit **bekannten Sollwerten**, z. B.:
  - `stats-basic.json`: 3 Sessions (2 h, 4 h, 30 min), 7 Fänge, 3 Kontakte, 2 Fehlbisse, 1 Beobachtung → Soll: Landequote 7/10, Fänge/h = 7/6,5.
  - `stats-empty.json`, `stats-tiny.json` (unter den Mindestmengen).
  - `sessions-invalid.json`: Ende vor Start, 30-h-Session.
  - `timezone-edge.json`: Fang um 23:30 und 00:30 rund um die Sommerzeitumstellung.
  - `import-*.json`: gültig, falsches Format, manipulierte Prüfsumme, Teilfehler, 10 000 Einträge, Altprojekt-Export.
- Gewässer-Testpaket `app/tests/fixtures/water/` (Nettetal, Ausschnitt aus NRW, mit der geprüften Pipeline erzeugt) für Karte, Profil und Suche in E2E-Tests; ausgeliefert mit Range-Unterstützung (`serveWaterFixture`).

## 3. Funktionale Testfälle und Abnahmekriterien

### 3.1 PWA, Intro, Updates
| ID | Testfall | Erwartung |
|---|---|---|
| PWA-1 | Manifest und SW | Lighthouse „installierbar"; Icons 192/512/maskable vorhanden |
| PWA-2 | Kaltstart | Intro sichtbar, App interaktiv ≤ 1,2 s nach Intro-Start (Fixture-Netz) |
| PWA-3 | Reduced Motion (`emulateMedia`) | Keine Bewegung; statisches Logo ≤ 300 ms |
| PWA-4 | Rückkehr aus Hintergrund (`visibilitychange`) | Kein Intro |
| PWA-5 | Neue SW-Version | Hinweis „Update verfügbar"; kein Reload bei offenem Formular; nach Bestätigung neue Version aktiv |
| PWA-6 | Offline-Start nach Erstbesuch | Shell lädt; Offline-Indikator sichtbar; Fangbuch nutzbar |

### 3.2 Karte und Gewässer
| ID | Testfall | Erwartung |
|---|---|---|
| MAP-1 | Kartenstart / Einstellung „Nur auf Knopfdruck“ | Standard: Standort startet mit der Karte und zentriert. Mit „Nur auf Knopfdruck“ kein Abruf beim Start, beim ersten Tipp Erklärtext (Entscheidung 2026-10-22) |
| MAP-2 | Standort verweigert / nicht verfügbar | Beim Start still; auf Knopfdruck verständliche Meldung; Karte weiter nutzbar |
| MAP-3 | Tipp auf leere Fläche | Sheet „Neu an dieser Stelle" mit Typen |
| MAP-4 | Tipp auf Gewässer | Sheet mit Gewässername, Profil-Link |
| MAP-6 | OSM-Vermerk | Beim Start sichtbar, nach 5 s eingeklappt (ⓘ), per Tipp wieder offen; unter Über gelistet (✅ `map.spec.ts`) |
| MAP-7 | Ansicht nach Seitenwechsel | Weg vom Standort scrollen, Seite wechseln und zurück → Ansicht unverändert (Zoom auf den Standort nur einmal pro App-Start); Knopf „Zu meinem Standort“ führt zurück, auch bei 390 px sichtbar (✅ `map.spec.ts`) |
| NAV-1 | Gedrückt über die Leiste wischen | Glas-Linse folgt dem Finger, Punkt darunter vergrößert, Loslassen wählt und rastet ein; normaler Tipp unverändert (✅ `app.spec.ts`, `navLens.test.ts`) |
| NAV-2 | Durchsichtige Leiste | Hintergrund unter 50 % deckend; bei „Transparenz reduzieren" deckend, bei reduzierter Bewegung ohne Animation (✅ `app.spec.ts`) |
| MAP-5 | Basiskarte offline | Hinweis „Karte offline nicht verfügbar"; eigene Marker weiter sichtbar |
| WAT-1 | Suche „De Wittsee" (umlaut-/schreibweise-tolerant) | Treffer, Karte zoomt hin |
| WAT-2 | Stichprobe 20 Gewässer (Liste unten) | Alle gefunden, Land korrekt |
| WAT-3 | Profil eines unbenannten Teichs | „Unbenanntes Gewässer", Felder „unbekannt", Quelle OSM + Stand |
| WAT-4 | Datenpaket-Update, `wid` entfällt | Nachfolger-Vorschlag, keine stille Neuzuordnung. *Stand M4: noch nicht umgesetzt [O]; wird mit dem ersten Datenpaket-Update fällig (zweiter Datenstand nötig).* |
| WAT-5 | Tiefenkarte bei `status !== 'available'` | **Kein** Button; Text „nicht verfügbar" |
| PRM-1 | Gewässerkarte: Fachlogik | Eigener Link: ohne Schema → https, nur http(s), keine Zugangsdaten im Link; Einträge je Gewässer eindeutig, nur https (✅ `permits.test.ts`) |
| PRM-2 | Gewässerkarten-Dateien | Schema gültig; jedes Land hat einen Landesverband oder steht mit Grund unter „open“ (✅ `permitFiles.test.ts`, auch `pnpm validate:data`) |
| PRM-3 | Eigenen Link speichern/ändern/entfernen | Ein Link je Gewässer, Teil der Sicherung, Migration v3→v4 (✅ `waterLinkService.test.ts`, `db.test.ts`, `backupService.test.ts`) |
| PRM-4 | Profil mit geprüftem Eintrag / ohne / Land ohne Verband | „Zur Vereinsseite“ mit Prüfdatum; sonst Landesverband; Bremen: „noch kein geprüfter Landesverband“ (✅ `WaterPermitSection.test.tsx`) |
| PRM-5 | De Wittsee antippen | Zwei NRW-Verbände verlinkt (neuer Tab); ungültiger Link abgelehnt; eigener Link bleibt nach Neuladen, entfernbar; axe, 390 px (✅ `water.spec.ts`) |

Stichprobe WAT-2 (automatisiert: `tools/water-pipeline/src/sample.ts`, läuft in jedem Datenlauf; „Großer De Wittsee" heißt in OSM „De Wittsee", „Möhnesee" ist dort `name:de` der Möhnetalsperre): Bodensee, Chiemsee, Müritz, Steinhuder Meer, Edersee, Großer Plöner See, Starnberger See, Ammersee, Schweriner See, Großer Müggelsee, Kemnader See, Baldeneysee, Möhnesee, Großer De Wittsee, Hohendeicher See, Elbe, Rhein, Mittellandkanal, Dümmer, Senftenberger See.

### 3.3 Markierungen
| ID | Testfall | Erwartung |
|---|---|---|
| MRK-1 | Angelstelle anlegen, bearbeiten, löschen, rückgängig | Persistenz nach Reload; Undo stellt wieder her |
| MRK-2 | Steg vs. Stelle | Unterschiedliche Form **und** Glyph; Screenreader-Label unterscheidet |
| MRK-3 | Gewässerzuordnung | Automatisch bei Tipp in Gewässerfläche; manuell änderbar |

### 3.4 Fangbuch und Sessions
| ID | Testfall | Erwartung |
|---|---|---|
| CAT-1 | Fang mit Pflichtfeldern minimal | Speichern mit Typ + Zeit + Position möglich. *Automatisiert (M5.1): `catches.spec.ts`, `catchDraft.test.ts`* |
| CAT-2 | Fang komplett inkl. Foto im **Flugmodus** | Gespeichert; nach Neustart vorhanden; Foto ohne EXIF-GPS. *Automatisiert (M5.2): `photos.spec.ts` – offline erfassen mit Foto (EXIF mit GPS), offline neu starten, Foto 1600 px ohne EXIF* |
| CAT-3 | Fehlbiss/Kontakt | Kein Gewichtsfeld „gewogen" anwählbar; Statistik zählt korrekt. *Formularteil automatisiert (M5.1); Statistik folgt mit M6* |
| CAT-4 | Ungültige Werte (Länge 900 cm) | Feldfehler, Formular bleibt offen, Daten bleiben erhalten. *Automatisiert (M5.1), inkl. Speichern nach Korrektur* |
| CAT-5 | Speicherfehler (Quota simuliert) | Fehlermeldung mit Option „Ohne Foto speichern"; kein Datenverlust. *Automatisiert (M5.2): E2E mit simuliertem QuotaExceededError, Unit-Test: Transaktion speichert nichts halb* |
| SES-1 | Session starten → 3 Fänge → beenden | Fänge zugeordnet; Dauer korrekt. *Automatisiert (M5.4): `sessions.spec.ts`, `session.test.ts`* |
| SES-4 | Pause/Weiter in laufender Session; Pause nachtragen/entfernen | Kopfzeile zeigt „Pause“; Angelzeit = Dauer − Pausen; Überschneidung/außerhalb abgelehnt; Fänge/h ohne Pausen (✅ `sessions.spec.ts`, `sessionPauses.test.ts`) |
| SES-2 | Zweite Session starten, während eine läuft | Nicht möglich, Hinweis. *Automatisiert: Startknopf fehlt; Datenschicht lehnt ab (`sessionService.test.ts`)* |
| TRK-1 | GPS-Punkte annehmen/verwerfen | Ungenau (> 50 m), zu früh (< 10 s), zu nah (< 8 m), Sprung (> 15 m/s) verworfen; Neustart/Lücke → neuer Abschnitt; Strecke entlang der Punkte (✅ `track.test.ts`) |
| TRK-2 | Wiedergabe-Logik | Route wächst bis t, Kopf interpoliert, Lücken nicht verbunden; Vereinfachung ≤ 1500 Punkte; Marker an derselben Stelle auseinandergezogen (✅ `track.test.ts`) |
| TRK-6 | Hintergrund-Route iPhone-App (Weg B) | Puffer prüfen: nur gültige Punkte, sortiert, ohne doppelte Zeitpunkte (✅ `track.test.ts`); Punkte zählen nach Zeitpunkt (vor Pause/Ende ja, in Pause/danach nein), `drainInto` speichert nacheinander, nur der erste beginnt einen Abschnitt (✅ `trackService.test.ts`); Swift-Modul, Sperrbildschirm, blaue Anzeige, Akku nur am iPhone [O] |
| TRK-3 | Route speichern | Sofort gespeichert; Pause/Ende nehmen nichts an; Fix vor Beginn verworfen (✅ `trackService.test.ts`); DB v2 → v3 (✅ `db.test.ts`); Sicherung mit Routen, alte ohne Routen (✅ `backupService.test.ts`) |
| REV-1 | Session mit GPS aufzeichnen, App neu laden, beenden | Status „GPS aktiv“, Punkte/km, schwaches Signal, ein Zuhörer; nach Neuladen Route da + neuer Abschnitt; Ende → Rückblick öffnet sich, Zuhörer weg; Liste „mit Route“ + Zugang (✅ `review.spec.ts`) |
| REV-2 | Rückblick abspielen | Autostart, Pause, Marker erst ab ihrem Zeitpunkt, Lücke nicht verbunden, 4×, Ganze Route, erneut abspielen; Highlights = gespeicherte Werte; Chronik ↔ Karte; übereinanderliegende Marker einzeln antippbar; Escape schließt (✅ `review.spec.ts`, `sessionReview.test.ts`) |
| REV-3 | Ohne Standortfreigabe | Session läuft normal, Hinweis + „erneut anfragen“; Rückblick ohne Route und ohne erfundene Highlights (✅ `review.spec.ts`) |
| REV-4 | Lange Session, 390 px, dunkel, offline | 6 000 Punkte flüssig (vereinfacht), kein seitliches Scrollen, Hinweis ohne Kartenhintergrund (✅ `review.spec.ts`) |
| SES-3 | Session > 24 h | Korrekturdialog. *Automatisiert: Hinweis in der Kopfzeile, Vorschlag übernehmen, Ende vor Beginn abgelehnt* |
| NEWS-1 | Neuigkeiten nach Update | Neue Installation ohne Fenster; nach Update einmal „Neu in Fangpunkt“ mit den ungesehenen Einträgen, danach nicht mehr; 390 px; unter „Über“ nachlesbar (✅ `whatsnew.spec.ts`, `whatsNew.test.ts`) |
| NEWS-2 | Bestandsnutzer ohne gemerkten Stand | Wer schon Daten hat, sieht den neuesten Eintrag; Escape schließt (✅ `whatsnew.spec.ts`) |
| USE-1 | Nutzungszählung: Pfade | Nur Bereiche, IDs werden zu `:id`, Unbekanntes zu `/sonstige`, Basis-Pfad entfernt; nur gültige Codes (✅ `usage.test.ts`) |
| USE-2 | Nutzungszählung: Abruf | Nur `p` + Cache-Brecher an `<code>.goatcounter.com/count`, ohne Cookies/Referrer; ohne Code kein Abruf (✅ `goatCounter.test.ts`); Datenschutz-Test erlaubt `*.goatcounter.com` (`privacy.spec.ts`) |
| WX-3 | Fang gerade erfassen | Wetter erscheint schon im Formular unter „Mehr Details“ (Modellwert, Quelle), „In die Felder übernehmen“ füllt Himmel/Lufttemperatur/Wind (Bft), gespeichert ohne zweiten Abruf; die letzten 48 h über die Forecast-API; auch die aufgerundete nächste Stunde (✅ `weather.spec.ts`, `weather.test.ts`, `openMeteo.test.ts`) |
| WX-1 | Fang offline, später online | Wetter wird nachgeladen; gekennzeichnet als Modellwert; Standard „an“; offline kein Abruf; Koordinaten gerundet; ausgeschaltet kein Abruf (✅ `weather.spec.ts`) |
| FC-1 | Bereich „Wetter“ | Über die Leiste erreichbar; Standort (gerundet) als Standard, Gewässer aus dem Fangbuch wählbar und gemerkt; jetzt/Luftdruck-Änderung/Verlauf (Grafik + Tabelle)/Tage; Dienst nicht erreichbar → letzte Vorhersage mit Hinweis; Zeitumstellung korrekt (✅ `forecast.spec.ts`, `forecast.test.ts`) |
| FC-3 | Beißfenster | Eigene Auswertung erst ab 20 Bissen, sonst „Zu wenige Daten (n)“; Bisse pro Angelstunde nur aus Sessions ohne Pausen; Luftdruck/Tendenz als Häufigkeit mit benannten Grenzen; Solunar nur im Tagesdetail (FC-6) mit Hinweis „wissenschaftlich nicht belegt“; Mondzeiten gegen USNO ±10 min, Beleuchtung ±2 % (✅ `forecast.spec.ts`, `solunar.test.ts`, `biteAnalysis.test.ts`) |
| CAL-1 | Angelkalender | Termin eintragen (Ende vor Beginn abgelehnt), Tag markiert, Wetter am Gewässer innerhalb 7 Tagen, später „Wetter ab …“, bearbeiten, löschen mit Rückgängig, 390 px (✅ `forecast.spec.ts`, `trip.test.ts`); DB v1 → v2 (`db.test.ts`); Sicherung mit/ohne Termine (`backupService.test.ts`); Alt-App-Termine (`legacy.test.ts`) |
| CAL-2 | Kalender-Ansichten | Monat/Woche/Tag umschaltbar und gemerkt, blättern je Ansicht, Kalenderwoche nach ISO, „Heute“ springt zurück, 390 px (✅ `forecast.spec.ts`, `trip.test.ts`) |
| ALERT-1 | Amtliche Warnungen | Wetter-Seite: Warnungen für die Gemeinde, höchste Stufe zuerst, abgelaufene nicht, Details/Hinweise, Quelle DWD; Termin mit Warnung im Zeitraum zeigt sie; ohne Warnung klarer Hinweis; nur gerundete Position (✅ `forecast.spec.ts`, `alerts.test.ts`, `brightSky.test.ts`, `privacy.spec.ts`) |
| CAL-3 | Termin in den Handy-Kalender | .ics-Datei je Termin und für alle anstehenden: UTC-Zeiten, Ganztag, Erinnerung (1 h vorher / Vorabend 18 Uhr), Maskierung und Zeilenfaltung nach RFC 5545 (✅ `forecast.spec.ts`, `ics.test.ts`); Übernahme in den iPhone-Kalender [O] am Gerät prüfen |
| GAUGE-1 | Pegel in der Nähe | Nächster Pegel ≤ 15 km mit Wasserstand (Hinweis „keine Wassertiefe“), Lage zu MNW/MHW, 24-h-Änderung, Wassertemperatur/Abfluss wo gemessen; sonst „Kein Pegel im Umkreis“ mit nächstem Pegel und Abdeckungshinweis; keine Position in den Anfragen (✅ `forecast.spec.ts`, `gauges.test.ts`, `pegelonline.test.ts`, `privacy.spec.ts`) |
| GAUGE-3 | Pegel am Fang | Fang mit Ort → nächster Pegel ≤ 15 km mit Messreihe zum Fangzeitpunkt, Wasserstand ±45 min, 24-h-Änderung, Lage nur bei Landespegeln; sonst „kein Pegel“/„zu alt“/„kein Messwert“ gespeichert; Reihe noch nicht da → offen; Netzfehler → offen; Zeit-/Ortsänderung verwirft; keine Position in Anfragen (✅ `weather.spec.ts`, `gaugeService.test.ts`, `gauges.test.ts`) |
| GAUGE-4 | Bisse nach Pegellage | Häufigkeit nach Lage (niedrig/normal/hoch) und Tendenz (24 h, ±2 cm) nur aus Einträgen mit Pegel, ab 20 (✅ `biteAnalysis.test.ts`) |
| GAUGE-2 | Landespegel NRW | Ort in NRW → Tagesdatei laden, nächster Landespegel mit Einzugsgebiet, Wasserstand, 24-h-Änderung, Lage zu MNW/MHW, Hinweis „Tagesdatei“, Quelle LANUK; außerhalb NRW kein Abruf (✅ `forecast.spec.ts`, `gauges.test.ts`, `hygonNrw.test.ts`) |
| FC-2 | Wetter ausgeschaltet | Keine Abfrage, Hinweis mit Link zu den Einstellungen (✅ `forecast.spec.ts`) |
| CSV-1 | Fangbuch als CSV | Excel-tauglich (BOM, Semikolon, Dezimalkomma), älteste zuerst, ohne gelöschte, Wetter als Modellwert, Formel-Einschleusung entschärft; leer → Hinweis (✅ `csv.spec.ts`, `csv.test.ts`, `catchCsv.test.ts`) |
| BOOK-1 | Fangbuch nach Gewässern | Reiter „Alle“ (Standard) + je Gewässer mit Name und Ort; bekannte Namen fest; unbekannte (≤ 200 m) umbenennbar, nur im Fangbuch; Suche nach Gewässer und Ort; Ort für Altbestand aus dem Suchindex (✅ `catches.spec.ts`, `waterGroups.test.ts`, `waterPlaceService.test.ts`) |
| HEAT-1 | Heatmap der Fänge | Standard aus; Knopf schaltet um (aria-pressed), Fang-Symbole und Zahlenkreise entfallen solange; gleich kräftig auf allen Zoomstufen; nur gelandete Fische; Wahl bleibt nach Neuladen; Leerzustand; unter 30 Fängen Hinweis auf Scheinmuster; Legende erklärt die Farben (✅ `heatmap.spec.ts`) |
| BAIT-1 | Favorit anlegen, im Fang per Tipp übernehmen, im Formular speichern, löschen | Details (Farbe, Größe, Gewicht, Haken, Methode) im Fang; doppelter Name abgelehnt; Rückgängig (✅ `baits.spec.ts`, `baitPreset.test.ts`) |

### 3.5 Statistik
*Automatisiert (M6): `domain/stats.test.ts` mit Fixture `test/fixtures/stats.ts`, E2E `stats.spec.ts` (STA-1 bis STA-7, hell und dunkel bei 390 px).*

| ID | Testfall | Erwartung |
|---|---|---|
| STA-1 | Fixture `stats-basic` | Alle Kennzahlen = Sollwerte |
| STA-2 | Leere Daten | Erklärender Leerzustand mit Aktion „Ersten Fang erfassen" |
| STA-3 | Unter Mindestmengen | „Zu wenige Daten (n = 3)" statt Quote |
| STA-4 | Filter Zeitraum/Art/Gewässer kombiniert | Werte = Unit-Referenz |
| STA-5 | Textprüfung | Kein „NaN", „Infinity", „undefined", „null" im DOM |
| STA-6 | 390 px Breite | Kein horizontales Scrollen |
| STA-7 | Diagramme | Jede Grafik hat eine Textalternative/Tabelle |

### 3.6 Recht
*Automatisiert (M7): LAW-1 `domain/regulations.test.ts` + `data/regulationFiles.test.ts` (alle Landesdateien, auch `pnpm validate:data`), LAW-2/LAW-3 Logik und Anzeige (`RegulationView.test.tsx`, Uhr per `nowMs`), LAW-4 `StateLawPage.test.tsx` (seit 2026-10-25 haben alle 16 Länder Angaben; `law.spec.ts` prüft die Übersicht inkl. axe und 390 px), sichtbares Land (Hamburg). Alle Landesdateien laufen durch `data/regulationFiles.test.ts`; der Lader wird mit echten Dateien getestet (`data/regulations.test.ts`). LAW-5 folgt mit Gewässerregeln (P3).*

| ID | Testfall | Erwartung |
|---|---|---|
| LAW-1 | Schema-Validierung aller Landesdateien | CI rot bei fehlender Quelle oder fehlendem `basisRef` |
| LAW-2 | `checkedAt` > 180 Tage (Uhr gemockt) | Banner „möglicherweise veraltet" |
| LAW-3 | Jahresübergreifende Schonzeit (z. B. 01.10.–01.03.) | Datum 15.01. → „in Schonzeit" |
| LAW-4 | Land ohne Daten | „Für <Land> noch keine geprüften Angaben" + Link zum Landesportal |
| LAW-5 | Gelandeter Fisch in Schonzeit / unter Mindestmaß / außerhalb des Fensters | Warnung mit Fundstelle im Formular (live) und am Eintrag, Speichern möglich; Land aus Fangort; Grenznähe → Land wählen (gespeichert); NRW „keine Prüfung möglich“ (✅ `law-check.spec.ts`, `regulationCheck.test.ts`, `geo.test.ts`) |
| LAW-6 | Daten ohne Landesgrenzen | „Bundesland unbekannt – keine Prüfung möglich“ (✅ `law-check.spec.ts`) |
| LAW-6 | Land öffnen, Fischart suchen, „Nur Fische in der Schonzeit“ | Suche nach deutschem/wissenschaftlichem Namen und Synonym, ohne Groß/Klein und Umlaute; Knopf zeigt Schonzeiten des Tages, Maße dieser Arten und ganzjährig geschonte; Fischereischein/weitere Regeln beim Filtern ausgeblendet mit Hinweis; leerer Treffer mit „Filter zurücksetzen“ (✅ `regulations.test.ts`, `RegulationView.test.tsx`, `law.spec.ts` Hamburg) |
| LAW-5 | Gewässer mit Landesrecht + Gewässerregeln (P3) | Getrennte Abschnitte, Quellen je Abschnitt |

### 3.6a Knoten
| ID | Testfall | Erwartung |
|---|---|---|
| KNT-1 | Zeichenkern | Kreuzungen erkannt, oben/unten nach Vorgabe, Abweichung gemeldet, Berührung an Strangenden zählt nicht, Zeichenreihenfolge je Ebene, Ersatzbilder (✅ `domain/knots.test.ts`) |
| KNT-2 | Katalog | 9 Knoten mit Texten, alle animiert; jede Zeichnung ohne Widerspruch, ein Bild je Schritt (✅ `catalog.test.ts`) |
| KNT-3 | Anleitung | Schritt vor/zurück, Schritt antippen, Wiedergabe schaltet weiter und hält am Ende, unbekannter Knoten (✅ `KnotDetailPage.test.tsx`) |
| KNT-4 | Mehr → Knoten | Liste (9 animiert), Filter, Wiedergabe, Verbindungsknoten mit zweiter Schnurfarbe, 390 px, axe (✅ `knots.spec.ts`) |
| KNT-5 | Reduzierte Bewegung | Keine Zeichenanimation, Bilder sofort (✅ `knots.spec.ts`) |
| RIG-1 | Montagen-Zeichenkern | Teile je Schritt, Reihenfolge und Zeiten der Animation, Prüfung der Vorgabe (✅ `domain/rigs.test.ts`) |
| RIG-2 | Montagen-Katalog | 8 Montagen, alle Angelarten, Texte vollständig, Zeichnungen ohne Fehler, Schritte = Bilder, Beschriftungen übersetzt (✅ `rigCatalog.test.ts`) |
| RIG-3 | Montagen-Ansicht | Filter nach Angelart, Wofür, Beschriftung je Schritt, Material, Link zu passenden Knoten, unbekannte Montage (✅ `RigDetailPage.test.tsx`) |
| WX-V1 | Wetter-Ansichtslogik | Symbole je Wettercode, Nacht, Stundenleiste mit Sonnenuntergang, Temperaturbalken, Farben, Tagesdetail H/T und Regen-%, Achsen, Solunar je Tag (`solunarDay`, `daySpan`) (✅ `domain/forecastView.test.ts`) |
| FC-6 | Wetter-Tagesdetail | Tag antippen → Wetterlage, Datumsleiste, Temperatur tatsächlich/gefühlt, Regen-%, Wind, Luftdruck, Sonne, Solunar-Zeiten mit Theorie-Hinweis, anderer Tag, Escape, axe hell/dunkel (✅ `forecast.spec.ts`); Übersicht mit Stundenleiste und 10-Tage-Liste in FC-1 |
| RET-1 | Köderführung-Katalog | 8 Techniken, beide Wassertiefen, Texte vollständig, Zeichnungen ohne Fehler, jeder Schritt bewegt den Köder, Beschriftungen übersetzt (✅ `retrieveCatalog.test.ts`); Kern: Tempo je Bewegung, Bahn des Schritts, Endlage/Richtung (✅ `domain/rigs.test.ts`) |
| RET-2 | Köderführung-Ansicht | drei Reiter, Filter, Wofür, Beschriftung je Schritt, Montagen-Link, unbekannte Technik (✅ `RetrieveDetailPage.test.tsx`) |
| RET-4 | Angler und Rute | Rutenwinkel über die Zeit, Rutenspitze, Schnur locker/straff (✅ `domain/angler.test.ts`); jede Köderbewegung hat eine Rutenbewegung (✅ `retrieveCatalog.test.ts`) |
| RET-3 | Mehr → Köderführung | Reiter, Anleitung, Angler mit Rute und Schnur, laufender Köder, Wiedergabe, reduzierte Bewegung = ruhender Köder, 390 px, axe hell/dunkel (✅ `knots.spec.ts`) |
| RIG-4 | Mehr → Knoten & Montagen → Montagen | Umschalter, Filter, Wiedergabe, Knoten-Link, 390 px, axe hell und dunkel (✅ `knots.spec.ts`) |

### 3.6b Konto
| ID | Testfall | Erwartung |
|---|---|---|
| ACC-1 | Regeln | E-Mail, Code (6–10 Ziffern), Passwort (≥ 10, leicht zu erraten, nicht die E-Mail) und Stärke, Nutzername wie in der Datenbank-Regel, Anzeigename, Fehlerarten (falsches Passwort, nicht bestätigt, schwach, gleich, E-Mail vergeben), Wartezeit, Links aus den Mails (✅ `domain/account.test.ts`) |
| ACC-2 | Kontoseite | Registrieren mit Passwort + Bestätigungscode, Regeln vorher, falscher/richtiger Code, Profil, abmelden, mit falschem/richtigem Passwort anmelden; „Passwort vergessen?“ mit Code → neues Passwort (auch Konto aus der Code-Zeit); Hinweis „Passwort festlegen“, Passwort ändern nur mit dem aktuellen, andere Geräte abmelden; E-Mail ändern nur mit Passwort; löschen nur mit Nutzername + Passwort; nicht eingerichtet, Ladefehler (✅ `AccountPage.test.tsx`) |
| PRF-1 | Profil-Datendienst | Profil anlegen/ändern, Profilbild ersetzen/entfernen, Beitrag mit neuen Fotos und Kopien von Fangfotos, Text ändern, löschen/wiederherstellen, ohne Foto kein Beitrag, Teil der Sicherung (✅ `profileService.test.ts`); Migration v4 → v5 (✅ `db.test.ts`) |
| PRF-2 | Leiste | Karte · Fangbuch · Profil · Wetter · Mehr; Statistik als Reiter im Fangbuch, Fangbuch dabei aktiv (✅ `AppShell.test.tsx`, `app.spec.ts`) |
| PRF-4 | Profilseite | einrichten mit Bild, Name, Text; Beitrag mit 2 Fotos; Raster; Beitrag ansehen, Text ändern, löschen + Rückgängig; bleibt nach Neustart; „Profil teilen“ → Demnächst; 390 px, axe hell/dunkel (✅ `profile.spec.ts`) |
| PRF-7 | Kommentar-Fenster herunterziehen | Regeln (Viertel der Höhe oder schneller Wisch) (✅ `sheetDrag.test.ts`); kurzes langsames Ziehen federt zurück, langes schließt – per Touch (✅ `profile.spec.ts`) |
| AVA-1/2, MODA-4 | Profilbild auf dem Server | Plan/Pfade/Zeilen (✅ `avatarSync.test.ts`); hochladen, ersetzen (altes erst danach gelöscht), entfernen, Bild der Freundin im Feed; ohne Server-Profil bleibt es lokal ohne Datei-Rest; Moderator entfernt mit Bestätigung und Protokoll (✅ `account.spec.ts`); RLS/Funktionen gegen Postgres 16 mit Supabase-Nachbildung geprüft (Fremdordner, falsche Pfade, Blockierte, Gesperrte, anon, Nicht-Moderator) |
| DISC-1 | Entdecken | Reiter Freunde/Entdecken, öffentliche Beiträge anderer, leerer Zustand, Hinweis bei „Alle“, axe hell/dunkel (✅ `account.spec.ts`); `sharedAt` gelesen (✅ `feed.test.ts`); Server gegen Postgres 16: nur `public`, ohne eigene/Blockierte/Gesperrte, Seitenweise, anon gesperrt ✅ |
| DISC-2 | Tagesgrenze | 21. neuer Beitrag in 24 h → `too_many_posts`, Upsert auf vorhandenen erlaubt, `shared_at` nicht vom Gerät setzbar (✅ Postgres 16); Beitrag bleibt vorgemerkt, Hinweis (✅ `postSyncService.test.ts`) |
| GRP-1 | Gemeinsame Session einladen | Freunde wählen (freie Plätze), gemeinsame Session wird angelegt, Teilnehmer, Beenden als Gastgeber beendet sie, axe hell/dunkel, 390 px (✅ `account.spec.ts`); Regeln `groupSessions.test.ts` ✅; Server gegen Postgres 16: nur Freunde, höchstens 10, Abgelehnte nicht erneut, nur Gastgeber lädt ein/beendet, nach Ende keine Einladung/Zusage, Fremde sehen nichts, Tabellen nicht direkt lesbar, anon gesperrt, Mitteilung nur bei eingeschalteter Art, alte App behält `sessions` ✅ |
| GRP-2 | Einladung beantworten | Zusagen startet/verknüpft eigene Session, Ablehnen, Verlassen löst nur die Verknüpfung (✅ `account.spec.ts`, `groupSessionService.test.ts`) |
| GRP-3 | Highlights | In der Session und im Feed mit Kennzeichnung, eigener Fang als Highlight (ohne Sichtbarkeitswahl), axe hell/dunkel (✅ `account.spec.ts`); Server gegen Postgres 16: nur Teilnehmer posten/sehen (auch nicht befreundet, auch nach Verlassen), Freund ohne Teilnahme und Eingeladene sehen nichts, nie unter Entdecken, Blockieren blendet aus, Sichtbarkeit bleibt Freunde, Session weg → nur Freunde ✅ |
| LAW-7 | Land aus Gewässer und Position | gleiches Land, Grenznähe mit passendem Gewässerland, Widerspruch → Wahl (Gewässerland zuerst), ohne Position (✅ `regulationCheck.test.ts`) |
| LAW-8 | Eigene Gewässerregeln | im Gewässerprofil eintragen, bleibt nach Neuladen, entfernen, axe hell/dunkel; in der Prüfung beim Fang als ungeprüft gekennzeichnet (✅ `water.spec.ts`, `law-check.spec.ts`); Speichern/Leeren (✅ `waterRulesService.test.ts`); Migration v6 → v7 (✅ `db.test.ts`) |
| LAW-9 | Prüf-Erinnerung | 30 Tage vor „möglicherweise veraltet“ fällig, danach überfällig, Entwürfe nie (✅ `regulations.test.ts`) |
| SHR-1 | Teilen eigener Beiträge | Teilen-Symbol schickt Foto(s) und Text ans Teilen-Menü (ersetzt im Test), ohne Fangort; ohne Teilen-Funktion kein Knopf (✅ `profile.spec.ts`); Text und Dateinamen (✅ `share.test.ts`) |
| SHR-2 | Profil teilen | Link mit Nutzernamen ans Teilen-Menü, ohne Teilen-Funktion in die Zwischenablage (✅ `account.spec.ts`); ohne Konto Hinweis (✅ `profile.spec.ts` PRF-4); nur gültige fangpunkt.com-Links führen ins Profil (✅ `profileLink.test.ts`); Universal Link am iPhone [O] |
| PST-5 | Automatische Übertragung | Vor der Anmeldung gepostet → nach der Anmeldung ohne Zutun hochgeladen, Sichtbarkeit bleibt, Stand unter Einstellungen (✅ `account.spec.ts`); ohne Sichtbarkeit → „Nur ich“ + „bitte prüfen“, nur lokale/nicht gelöschte/nicht fremde, Datum bleibt, keine Doppelten (✅ `postSyncService.test.ts`) |
| PST-6 | Weiteres Gerät | Eigene Server-Beiträge erscheinen samt Fotos im Profil, nichts wird zurückgeschickt, nach Neuladen keine Doppelten (✅ `account.spec.ts`; Fotos/Vorschau/Datum/gelöscht ✅ `postSyncService.test.ts`) |
| PST-7 | Server-Regeln mit echten Rechten | Upsert scheitert (Ursache), `publish_post` privat/Freunde/Alle, erneut = kein Duplikat, Datum bleibt/Zukunft gekappt, fehlendes Foto, fremder Ordner, falsche Sichtbarkeit, Übernahme fremder ID; Sichtbarkeit für Verfasser/Freund/Fremden in Tabelle, Feed, Entdecken, Profil, Fotos; Wechsel auf privat, beendete Freundschaft; Mitteilungen nicht bei privat/alt (✅ `supabase/tests/publish_post.sql`, `run.sh`) |
| PRF-14 | Beiträge wie Instagram | Angetippter Beitrag oben, ältere darunter; Fischart · Länge im Kopf; unter dem Bild keine Knöpfe/Hinweise; Optionen über „⋯“ gelten für den jeweiligen Beitrag; 390 px dunkel, axe (✅ `profile.spec.ts`) |
| PUSH-4 | Weitere Mitteilungen + Test | Server: neuer Beitrag an Freunde (Einstellung „posts“ aus → keiner), Kommentar-Verlauf (gedrosselt), Zusage an Gastgeber, Highlight an Teilnehmer, Test nur mit Gerät, Grenze 10/h, alte `set_push_prefs`-Aufrufe behalten „posts“ (✅ lokaler PG-16-Test); App: Stand/Test-Ergebnis, neue Art (✅ `PushSettings.test.tsx`, `push.test.ts`); Zustellung am iPhone [O] |
| PRF-12 | Profil erweitern (Paket 11) | Lieblingsfische (höchstens 5), Methoden, Region (Bundesland) speichern und im Profil zeigen; Beitrag anheften/lösen, Highlights-Leiste, 390 px dunkel, axe (✅ `profile.spec.ts`); Regeln `toggleHighlight`/`highlightedPosts`/`toggleInList` (✅ `profile.test.ts`), Speichern/Entfernen/Sicherung, höchstens drei angeheftet (✅ `profileService.test.ts`) |
| SOC-1..3 | Freunde finden, Profile ansehen, Session teilen (Paket 12) | Suche ab 3 Zeichen, Treffer mit Beziehung, Profil eines Freundes mit Text/Angaben/Highlights/Beiträgen, Fremder ohne Angaben mit Anfrage, unbekannt, 390 px hell/dunkel, axe (✅ `account.spec.ts` SOC-1); eigene Angaben gehen einmal an den Server (✅ SOC-2); Zeilen prüfen, Suchbegriff, nur geteilte Highlights (✅ `userProfile.test.ts`); Server: Sichtbarkeit nur Freunde, Blockierte/Gesperrte, Grenzen, Prüfungen, Moderation (✅ lokaler PG-16-Test); Session-Zusammenfassung als Beitrag ohne Ort (✅ `sessions.spec.ts` SES-9, `sessionShare.test.ts`) |
| SHR-2 | Dateien sichern in der App | in der App Teilen-Menü, Abbrechen kein Fehler, sonst/als Rückfall Download (✅ `lib/share.test.ts`); am iPhone noch ungeprüft [O] |
| SAVE-1 | Beiträge speichern | Speichern im Feed, Liste „Gespeichert“, Entfernen, leerer Zustand, axe hell/dunkel (✅ `account.spec.ts`); Server-Regeln gegen Postgres 16 mit Nachbildung (nur eigene, nur sichtbare, nach Freundschaftsende raus, anon gesperrt) ✅ |
| FEED-5, PRF-5 | Fischart/Länge am Beitrag | Eingabe (✅ `profile.test.ts`); aus dem Fang vorausgefüllt, ungültige Länge erklärt, Etikett auf Beitrag und im Feed, Upload mit `species_id`/`length_cm` (✅ `profile.spec.ts`, `account.spec.ts`); Server-Prüfung gegen Postgres 16 mit Nachbildung ✅ |
| ERF-1/2 | Erfolge | Zählregeln, Schwellen, Variante A (nie entfernen), erster Abgleich still, Kaputtes fällt weg (✅ `achievements.test.ts`); Profil-Zahl, „Neu“-Markierung bis zum Ansehen, Übersicht, axe hell/dunkel, Stufen bleiben nach Löschen, frische Fänge zählen erst nach einem Tag (✅ `achievements.spec.ts`) |
| FC-6 (erweitert) | Beißprognose | Regeln je Faktor, Grenzen, Einordnung, „unknown“ ohne Luftdruck/Wind, fehlende Faktoren zählen nicht (✅ `fishingOutlook.test.ts`); Etikett in der 10-Tage-Liste, Gründe/Dämmerung/„Faustregel“ im Tagesdetail, axe hell/dunkel (✅ `forecast.spec.ts`) |
| PRF-9/10, FEED-4 | Hecht beim Doppeltipp | Form, Bahn bleibt im Bild, Abtauchen über dem Daumen, Zeitplan, Doppeltipp vs. Wischen (✅ `pikeSwim.test.ts`); Hecht sichtbar, Daumen erst zur Ankunft, nie zurücknehmen, Wischen ≠ Doppeltipp, Verlassen mittendrin setzt trotzdem, reduzierte Bewegung sofort ohne Hecht (✅ `profile.spec.ts`); Feed: genau ein `toggle_like` bei mehreren Doppeltipps (✅ `account.spec.ts`); Gefühl auf dem iPhone nur am Gerät [O] |
| PRF-8 | Profilbild zuschneiden | Rechnung (Begrenzung, Zoom um den Fingerpunkt, Ausschnitt unabhängig von der Rahmengröße) (✅ `avatarCrop.test.ts`); Abbrechen behält das alte Bild, Verschieben/Regler/Tastatur/Zurücksetzen, gespeichert quadratisch mit gewähltem Ausschnitt, axe und 390 px (✅ `profile.spec.ts`); Zwei-Finger-Zoom nur auf dem Gerät [O] |
| PRF-6 | Gefällt mir und Kommentare | Daumen an/aus, Doppeltipp setzt nur, Kommentar im Fenster von unten senden (leer gesperrt, Emoji einfügen, Enter), löschen + Rückgängig, Escape schließt, bleibt nach Neustart, Sichtbarkeit „Alle“, 390 px, axe hell/dunkel (✅ `profile.spec.ts`); Dienst inkl. Sicherung (✅ `profileService.test.ts`), Migration v5 → v6 (✅ `db.test.ts`) |
| PRF-5 | Beitrag aus Fang | „Im Profil posten“ im Fang, Fangfoto vorausgewählt, Beitrag verlinkt den Fang (✅ `profile.spec.ts`) |
| ACC-4 | Links aus den Mails | Bestätigungslink → angemeldet mit „E-Mail bestätigt“; Passwort-Link → „Neues Passwort festlegen“; abgelaufener Link → Hinweis und Formular (✅ `account.spec.ts`, `authLinkInHash` in `account.test.ts`) |
| ACC-3 | Mehr → Konto mit nachgebildetem Supabase | Anmeldemaske (autocomplete für den Schlüsselbund), registrieren mit Passwort + Code, Profil, Anmeldung bleibt nach Neuladen, abmelden, falsches/richtiges Passwort, löschen mit Passwort, nur Auth/Profil-Aufrufe, nach Löschen keine Sitzung, 390 px, axe hell/dunkel (✅ `account.spec.ts`); ohne Anmeldung keine Anfrage an Supabase (✅ `privacy.spec.ts`) |
| ACC-6 | Passwort vergessen und Sicherheit | „Passwort vergessen?“ per Code → neues Passwort → angemeldet; Passwort ändern (andere Geräte abgemeldet), E-Mail ändern, „Auf allen anderen Geräten abmelden“, axe hell/dunkel (✅ `account.spec.ts`) |
| ACC-5 | Konto freigeschaltet (2026-11-03) | Mehr → Konto zeigt Formular statt „Demnächst“, ohne Eingabe keine Anfrage an Supabase, axe (✅ `account.spec.ts`) |
| BADGE-1 | Abzeichen-Regeln | nur bekannte Abzeichen vom Server, gemerkter Stand nur für dieselbe Nutzer-ID, kaputter/manipulierter Speicher = keins (✅ `domain/badges.test.ts`) |
| BADGE-2 | Kontoseite | FOUNDER nur beim Konto, dem der Server es gibt; anderes Konto auf demselben Gerät ohne (✅ `AccountPage.test.tsx`) |
| BADGE-3 | FOUNDER sichtbar | Konto, Profil (groß), Beitrag und Kommentar (klein), 390 px, axe hell/dunkel (✅ `account.spec.ts`) |
| BADGE-4 | Manipulation | normales Konto ohne Abzeichen; selbst eingetragenes Abzeichen im Gerätespeicher wird vom Server überschrieben; Abmelden löscht es (✅ `account.spec.ts`); Schreiben in `user_badges` ohne Rechte (RLS, keine Schreib-Policy, `revoke`) – live geprüft [V 2026-11-03]: ohne Anmeldung Lesen/Eintragen/Löschen → 42501; Founder-Konto sieht das Abzeichen (vom Nutzer bestätigt) |
| FRD-1 | Freunde-Regeln | Server-Antwort lesen (nur bekannte Abzeichen, Kaputtes fällt weg), Gruppen Anfragen/Gesendet/Freunde nach Name, Fehlerarten (✅ `domain/friends.test.ts`) |
| FRD-2 | Freunde-Seite | Anfrage annehmen (mit Abzeichen), unbekannter Name, senden (mit @ und Großschreibung), zurückziehen, entfernen mit Bestätigung, Zahl im Profil, 390 px, axe hell/dunkel (✅ `account.spec.ts`) |
| FRD-3 | Ohne Anmeldung | Hinweis aufs Konto, keine Anfrage an Supabase (✅ `account.spec.ts`) |
| PST-1 | Abgleich-Plan | neu/geändert/unverändert/lokal, gelöscht entfernt nur Hochgeladenes, nur eigenes Konto, nur fällige Versuche, nie bei fehlender Datei, Wartezeiten, Anzeige, Zusammenfassung, Pfade (✅ `domain/postSync.test.ts`) |
| PST-2 | Abgleich | hochladen mit Vorschaubildern, Änderung nachziehen (auch „Nur ich“), löschen + wiederherstellen, ohne Verbindung wachsende Pause + „Erneut versuchen“, Tagesgrenze 1 h, fehlende Fotodatei (✅ `data/postSyncService.test.ts`) |
| PST-3 | Beitrag sichern (Oberfläche) | angemeldet: Hinweis, „Nur ich“ wählbar, Upload über `publish_post` mit Foto + Vorschaubild (nie direkt auf die Tabelle), Bearbeitung folgt, Wechsel auf „Nur ich“ bleibt auf dem Server (✅ `account.spec.ts`) |
| PST-4 | Ohne Anmeldung | Beitrag bleibt lokal, keine Anfrage an Supabase (✅ `account.spec.ts`) |
| FEED-1 | Feed-Regeln | Server-Antwort lesen (ohne Foto/kaputt fällt weg), Seiten ohne Doppelte zusammenführen, „mehr laden“ nur nach voller Seite, Anfangsbuchstabe (✅ `domain/feed.test.ts`) |
| FEED-2 | Feed | Leiste mit 6 Punkten, Beiträge mit Fotos (zeitlich begrenzte Adressen), Name, Abzeichen, Text, Ende der Liste, 390 px, axe hell/dunkel (✅ `account.spec.ts`) |
| FEED-3 | Leer / ohne Anmeldung | leerer Feed → „Freunde hinzufügen“; ohne Anmeldung Hinweis, keine Anfrage an Supabase (✅ `account.spec.ts`) |
| SPOT-1 | Geteilte Spots lesen | Server-Zeilen mit genauer Position, kaputte fallen weg; derselbe Ort (persönlich + alle Freunde) nur einmal; übernommene nicht doppelt auf der Karte (✅ `sharedSpots.test.ts`, `geojson.test.ts`) |
| SPOT-2 | Übernehmen | wird eigener Ort mit Art, Name, Notiz + Herkunft und genauer Position; zweimal übernehmen ergibt keinen zweiten (✅ `sharedSpotService.test.ts`) |
| SPOT-3 | Teilen auf der Karte | Spot eines Freundes als violetter Pin, Blatt mit Name/Abzeichen/Notiz, übernehmen; eigenen Ort mit allen Freunden und einem Freund teilen (genau die gespeicherte Position), Teilen beenden; Übersicht im Profil; 390 px, hell/dunkel ohne axe-Verstöße (✅ `account.spec.ts`) |
| SPOT-4 | Ohne Anmeldung | Übersicht und Teilen-Seite zeigen Hinweis aufs Konto, keine Anfrage an Supabase (✅ `account.spec.ts`) |
| MOD-1 | Melden/Blockieren-Logik | Gründe = Server-Werte, Hinweis gekürzt; blockierte Konten lesen; Ausblenden von Inhalt und ganzer Person; Regeln-Zustimmung je Version, kaputter Wert fragt erneut (✅ `moderation.test.ts`) |
| MOD-2 | Beitrag melden | „…“ im Feed → Melden, Grund Pflicht, Hinweis optional; Meldung an den Server, Beitrag sofort und nach Neuladen ausgeblendet; Fenster hell/dunkel ohne axe-Verstöße (✅ `account.spec.ts`) |
| MOD-3 | Blockieren | Freund blockieren → Freundschaft endet, Liste „Blockiert“, Beiträge weg; Freigeben; 390 px, hell/dunkel (✅ `account.spec.ts`) |
| MOD-4 | Spot melden | geteilten Spot melden → aus der Liste verschwunden (✅ `account.spec.ts`) |
| MOD-5 | Regeln vor dem Registrieren | „Konto erstellen“ öffnet die Regeln; Ablehnen verschickt keine Mail, Akzeptieren schon (✅ `AccountPage.test.tsx`, ACC-3 in `account.spec.ts`) |
| REACT-1 | Reaktionen-Logik | Zahlen und Kommentare vom Server lesen (kaputte/leere fallen weg, älteste zuerst), Daumen sofort umschalten ohne negative Zahl, Fehler zuordnen (✅ `reactions.test.ts`) |
| REACT-2 | Feed | Daumen hoch mit Zahl, Kommentar schreiben und eigenen löschen, fremden nicht löschbar, aber meldbar (danach ausgeblendet); Fenster hell/dunkel ohne axe-Verstöße (✅ `account.spec.ts`) |
| REACT-3 | Eigener geteilter Beitrag | Gefällt mir und Kommentare gehen an den Server, nichts landet lokal (✅ `account.spec.ts`) |
| PUSH-1 | Push-Logik | Einstellungen lesen (fehlend/kaputt = alles an), Antippen nur in bekannte Bereiche, Token nur Hexziffern (✅ `push.test.ts`) |
| PUSH-2 | Gerät anmelden | einmal von selbst fragen, nach „Nein“ nicht erneut; mit Erlaubnis Token an den Server; Abmelden entfernt es; im Browser nichts (✅ `pushDevice.test.ts`) |
| PUSH-3 | Einstellungen → Mitteilungen | im Browser unsichtbar; jede Art einzeln, auf dem Server gespeichert; Knopf „Erlauben“ bzw. Hinweis auf die iPhone-Einstellungen (✅ `PushSettings.test.tsx`) |
| PUSH-4 | Auf dem iPhone (von Hand, TestFlight) | Erlaubnis-Dialog nach der Anmeldung; Mitteilung bei Anfrage, Gefällt mir, Kommentar, Spot; Antippen öffnet den Bereich [O] |
| MODA-1 | Moderations-Logik | Meldungen, Inhalt, Konto, Inhalte, Protokoll lesen (kaputte fallen weg, fehlender Inhalt = gelöscht); Sperrdauer 1/7/30/dauerhaft, Restzeit; Fehler zuordnen (✅ `modAdmin.test.ts`) |
| MODA-2 | Moderationsbereich | Mehr → Moderation → Meldung: Inhalt löschen, Sperren (Grund Pflicht, 7 Tage voreingestellt), Konto-Seite mit Restzeit und Protokoll, Sperre aufheben, Meldung erledigt; 390 px, hell/dunkel (✅ `account.spec.ts`) |
| MODA-3 | Ohne Recht | kein Eintrag unter Mehr, Seite zeigt Hinweis (✅ `account.spec.ts`); der Server prüft jede `mod_*`-Funktion selbst (von außen geprüft nach dem Einspielen) |

### 3.7 Datensicherung
| ID | Testfall | Erwartung |
|---|---|---|
| BAK-1 | Export → alles löschen → Import | Daten bit-identisch (ohne `updatedAt`-Drift) |
| BAK-2 | Import ungültiges JSON / falsches Format | Abbruch, **keine** Änderung an der DB |
| BAK-3 | Import mit Konflikten | Vorschau zeigt neu/identisch/Konflikt; Standardstrategie „Neuere behalten" |
| BAK-4 | Import bricht mitten ab (Fehler injiziert) | Rollback; Zustand wie vorher |
| BAK-5 | 10 000 Einträge | Import < 10 s auf Desktop [A]; UI bleibt bedienbar (Fortschritt) |
| BAK-6 | Backup-Erinnerung | Erscheint nach Schwelle (5 Änderungen oder 14 Tage), „Später" pausiert 3 Tage |
| BAK-7 | Altprojekt-Import (E9), mit echten Exporten beider Alt-Apps | Mapping laut DATA_MODEL §8 korrekt. *Stand M2: automatisiert mit einem aus dem Alt-App-Code nachgebauten Export (`app/src/test/fixtures/legacy-angelkarte-v2.ts`); Prüfung mit einem echten Export steht aus [O].* |

## 4. Nicht-funktionale Kriterien

| Bereich | Kriterium |
|---|---|
| Performance | Lighthouse mobil: Performance ≥ 90, LCP ≤ 2,5 s (Shell); JS-Initial-Bundle ≤ 250 KB gzip ohne MapLibre, MapLibre lazy geladen |
| Barrierefreiheit | axe: 0 „serious/critical"; Kontrast AA; Tastatur bedienbar (Desktop); Touch-Ziele ≥ 44 × 44 px; Fokus-Rückgabe nach Dialogen. *Automatisiert (M11, 2026-10-22): `a11y.spec.ts` – axe (WCAG 2.1 A/AA) auf allen 14 Hauptansichten plus geöffneten Formularen, hell und dunkel, desktop und mobil (Stand: 0 Befunde jeder Stufe); Touch-Ziele ≥ 44 px auf dem Handy-Profil (Links im Fließtext und in Tabellen ausgenommen, WCAG 2.5.8). Tastatur (`keyboard.spec.ts`, Desktop): KEY-1 Navigation per Tab/Enter mit sichtbarem Fokus, Segment-Schalter per Pfeiltaste; KEY-2 Dialog: Fokus darin, Escape/Schließen, Fokus zurück zum Auslöser; KEY-3 Fang ganz ohne Maus („Kartenmitte“), Fokus danach auf „Fang erfassen“. Screenreader-Stichprobe: VoiceOver auf dem iPhone vom Nutzer am 2026-10-22 geprüft – klappt.* |
| Datenschutz | Kein Netzwerkaufruf mit Standort, außer Wetter (gerundet); keine Drittanbieter-Cookies; geprüft per Playwright-Netzwerkprotokoll. *Automatisiert (M11, 2026-10-22): PRIV-1 `privacy.spec.ts` – alle Hauptansichten, nur App-Server, OpenFreeMap und Open-Meteo; Wetteranfrage nur mit gerundeter Position, ohne Notizen/IDs; die Datenschutzseite nennt genau diese Server.* |
| Robustheit | Kein unbehandelter Promise-Fehler in E2E (`pageerror` = Testfehler) |
| Lizenzen | Attribution sichtbar für jede angezeigte Quelle; Quellenseite listet alle Lizenzen |

## 5. Geräte-Matrix (manuell, je Meilenstein)

| Gerät | Browser | Modus |
|---|---|---|
| iPhone (iOS ≥ 17) | Safari | Browser + installiert (Home-Bildschirm) |
| Android Mittelklasse | Chrome | Browser + installiert |
| Tablet (iPad oder Android) | Standard | Hoch- und Querformat |
| Windows/macOS | Chrome, Firefox, Safari (mac), Edge | Fenster 1280 und 1920 px |

Checkliste je Gerät: Installation, Intro, Standortfreigabe, Fang offline mit Foto, Export-Download, Import über Dateiauswahl, Update-Hinweis, Dunkelmodus.

## 5a. Umsetzung der Testfälle (Stand M2)

| Bereich | Datei | Umfang |
|---|---|---|
| Kontrast | `app/src/design/tokens.test.ts` | 34 Farbpaare hell/dunkel |
| Zeit | `app/src/domain/time.test.ts` | Sommer-/Winterzeit, Umstellung, Mitternacht |
| Repository, CAT-3/4 | `app/src/data/repository.test.ts` | Validierung, Revision, Papierkorb |
| Migration | `app/src/data/db.test.ts` | v1 → Probe-v2 mit Datenumwandlung |
| BAK-1…5, 7 | `app/src/data/backupService.test.ts` | Roundtrip JSON/ZIP, 7 Arten kaputter Dateien, Strategien, Rollback, Snapshots, 10 000 Einträge |
| BAK-6 | `app/src/domain/backup/reminder.test.ts` | Schwellen und „Später" |
| BAK-7 | `app/src/domain/backup/legacy.test.ts` | Feldabbildung der Alt-App |
| E2E | `app/tests/e2e/*.spec.ts` | PWA-1…4/6, Navigation, axe, Theme, Sicherungs-Ablauf komplett, Persistenz nach Neustart |
| Karte (M3) | `app/tests/e2e/map.spec.ts`, `app/src/features/map/*.test.ts` | MAP-1/2/3/5, MRK-1/2, Legende, Cluster, Theme-Stil; OpenFreeMap wird in Tests durch einen lokalen Stil ersetzt, Standort durch eine Attrappe |

## 6. Release-Abnahme 1.0 (Definition of Done)

- [ ] Alle CI-Stufen grün (Typen, Lint, Unit, Integration, E2E Chromium)
- [ ] E2E zusätzlich auf WebKit und Firefox grün
- [ ] Geräte-Matrix §5 abgehakt (Protokoll im PR)
- [ ] Keine offenen „kritisch"/„hoch"-Fehler
- [ ] Quellen- und Lizenzseite vollständig; Datenschutzhinweis vorhanden
- [ ] NRW `verified`; alle anderen Länder mit klarem Status (`partial`/`draft` oder „keine Angaben")
- [ ] Kein Feature behauptet Offline-Fähigkeit, die nicht durch PWA-6/CAT-2/M10-Test belegt ist

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
| FC-3 | Beißfenster | Eigene Auswertung erst ab 20 Bissen, sonst „Zu wenige Daten (n)“; Bisse pro Angelstunde nur aus Sessions ohne Pausen; Luftdruck/Tendenz als Häufigkeit mit benannten Grenzen; Solunar getrennt mit Hinweis „wissenschaftlich nicht belegt“; Mondzeiten gegen USNO ±10 min, Beleuchtung ±2 % (✅ `forecast.spec.ts`, `solunar.test.ts`, `biteAnalysis.test.ts`) |
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

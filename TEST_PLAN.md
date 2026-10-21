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
- Gewässer-Mini-Paket (Bremen-Ausschnitt aus Spike S1) als Fixture für Karte und Suche.

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
| MAP-1 | Standort-Button ohne Freigabe | Erklärtext, dann Browser-Prompt; **kein** Prompt beim App-Start |
| MAP-2 | Standort verweigert / nicht verfügbar | Verständliche Meldung, Karte weiter nutzbar |
| MAP-3 | Tipp auf leere Fläche | Sheet „Neu an dieser Stelle" mit Typen |
| MAP-4 | Tipp auf Gewässer | Sheet mit Gewässername, Profil-Link |
| MAP-5 | Basiskarte offline | Hinweis „Karte offline nicht verfügbar"; eigene Marker weiter sichtbar |
| WAT-1 | Suche „De Wittsee" (umlaut-/schreibweise-tolerant) | Treffer, Karte zoomt hin |
| WAT-2 | Stichprobe 20 Gewässer (Liste unten) | Alle gefunden, Land korrekt |
| WAT-3 | Profil eines unbenannten Teichs | „Unbenanntes Gewässer", Felder „unbekannt", Quelle OSM + Stand |
| WAT-4 | Datenpaket-Update, `wid` entfällt | Nachfolger-Vorschlag, keine stille Neuzuordnung |
| WAT-5 | Tiefenkarte bei `status !== 'available'` | **Kein** Button; Text „nicht verfügbar" |

Stichprobe WAT-2 (wird in S1/M4 bestätigt): Bodensee, Chiemsee, Müritz, Steinhuder Meer, Edersee, Großer Plöner See, Starnberger See, Ammersee, Schweriner See, Großer Müggelsee, Kemnader See, Baldeneysee, Möhnesee, Großer De Wittsee, Hohendeicher See, Elbe, Rhein, Mittellandkanal, Dümmer, Senftenberger See.

### 3.3 Markierungen
| ID | Testfall | Erwartung |
|---|---|---|
| MRK-1 | Angelstelle anlegen, bearbeiten, löschen, rückgängig | Persistenz nach Reload; Undo stellt wieder her |
| MRK-2 | Steg vs. Stelle | Unterschiedliche Form **und** Glyph; Screenreader-Label unterscheidet |
| MRK-3 | Gewässerzuordnung | Automatisch bei Tipp in Gewässerfläche; manuell änderbar |

### 3.4 Fangbuch und Sessions
| ID | Testfall | Erwartung |
|---|---|---|
| CAT-1 | Fang mit Pflichtfeldern minimal | Speichern mit Typ + Zeit + Position möglich |
| CAT-2 | Fang komplett inkl. Foto im **Flugmodus** | Gespeichert; nach Neustart vorhanden; Foto ohne EXIF-GPS |
| CAT-3 | Fehlbiss/Kontakt | Kein Gewichtsfeld „gewogen" anwählbar; Statistik zählt korrekt |
| CAT-4 | Ungültige Werte (Länge 900 cm) | Feldfehler, Formular bleibt offen, Daten bleiben erhalten |
| CAT-5 | Speicherfehler (Quota simuliert) | Fehlermeldung mit Option „Ohne Foto speichern"; kein Datenverlust |
| SES-1 | Session starten → 3 Fänge → beenden | Fänge zugeordnet; Dauer korrekt |
| SES-2 | Zweite Session starten, während eine läuft | Nicht möglich, Hinweis |
| SES-3 | Session > 24 h | Korrekturdialog |
| WX-1 | Fang offline, später online | Wetter wird nachgeladen; gekennzeichnet als Modellwert |

### 3.5 Statistik
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
| ID | Testfall | Erwartung |
|---|---|---|
| LAW-1 | Schema-Validierung aller Landesdateien | CI rot bei fehlender Quelle oder fehlendem `basisRef` |
| LAW-2 | `checkedAt` > 180 Tage (Uhr gemockt) | Banner „möglicherweise veraltet" |
| LAW-3 | Jahresübergreifende Schonzeit (z. B. 01.10.–01.03.) | Datum 15.01. → „in Schonzeit" |
| LAW-4 | Land ohne Daten | „Für <Land> noch keine geprüften Angaben" + Link zum Landesportal |
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
| Barrierefreiheit | axe: 0 „serious/critical"; Kontrast AA; Tastatur bedienbar (Desktop); Touch-Ziele ≥ 44 × 44 px; Fokus-Rückgabe nach Dialogen |
| Datenschutz | Kein Netzwerkaufruf mit Standort, außer Wetter (gerundet); keine Drittanbieter-Cookies; geprüft per Playwright-Netzwerkprotokoll |
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

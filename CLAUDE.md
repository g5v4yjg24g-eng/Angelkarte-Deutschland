# CLAUDE.md – Projektregeln

Deutschlandweite Angel-App als PWA namens **„Fangpunkt"** (Arbeitsname, E5). Nicht kommerziell (E3).
Planungsdokumente im Repo-Root: `PLAN.md`, `ARCHITECTURE.md`, `DATA_SOURCES.md`, `DATA_MODEL.md`, `TEST_PLAN.md`. **Vor jeder größeren Änderung lesen.** Bei Abweichungen das Dokument im selben PR aktualisieren.

## Projektstatus
- Phase: **M7.1 umgesetzt** (PLAN.md §4): Fangbuch, Sessions, Statistik, Rechtsstruktur. Offen: M7.2 NRW-Inhalt aus dem amtlichen Text.
- Recht: Schema/Logik `app/src/domain/regulations.ts`, Daten `app/data/regulations/<KÜRZEL>.json` (nur aus dem amtlichen Text), Ansicht `app/src/features/law`. `draft` nur in der Prüfansicht `?pruefung=1`. Sichtbar (`partial`, vom Nutzer gegengeprüft 2026-10-22): alle Länder außer NW, Fischereischein-Regeln überall erfasst. Offen (zurückgestellt): Berlin Landesfischereischeingesetz (vom Nutzer nicht auffindbar), Abgabehöhen-Verordnungen TH/SH/ST/RP, SH Urlauberfischereischein. NW: Entwurf `NW.json` (draft, 2026-10-24 aus recht.nrw.de: LFischG ab 01.07.2026, LFischVO ab 03.07.2026), Gegenprüfung durch den Nutzer offen – bis dahin in der App „keine Prüfung möglich“. PDF-Text vor dem Lesen von Seitenvorschüben (`\f`) befreien. Übersichtsseiten von Behörden ohne Fundstellen sind keine Quelle. Texte gesperrter Portale schickt der Nutzer als PDF. `import.meta.glob` ohne Typparameter aufrufen (mit `glob<…>(` liefert Vite `{}`).
- Wetter am Fang: Fachlogik `domain/weather.ts`, Port `ports/weather.ts`, Adapter `adapters/openMeteo.ts` (Historical-Forecast-API, ab 2022), Nachladen `data/weatherService.ts` + `features/weather/WeatherSync.tsx`. Im Erfassungsformular zeigt `features/weather/FormWeather.tsx` (+ `useFormWeather.ts`) das Wetter schon vor dem Speichern (wird mitgespeichert; Übernehmen in die eigenen Felder nur per Knopf). Letzte 48 h über die Forecast-API (`isRecentQuery`), nächste volle Stunde zählt mit (`weatherAvailable`). Einstellung `weatherEnabled` standardmäßig an (Entscheidung Nutzer 2026-10-22); Koordinaten nur gerundet (3 Stellen). E2E mockt `historical-forecast-api.open-meteo.com` (`weather.spec.ts`).
- Wetter-Bereich (`/wetter`): Vorhersage `domain/forecast.ts` + `ports/forecast.ts` (Forecast-API), Beißfenster `domain/biteAnalysis.ts` (eigene Bisse, ab 20) und `domain/solunar.ts` (Mond offline, Theorie-Hinweis Pflicht), Ansicht `features/weather/WeatherPage.tsx` + `BiteWindows.tsx`. Angelkalender `/wetter/kalender`: Logik `domain/trip.ts` (Monat/Woche/Tag, ISO-KW, `shiftDate`), Tabelle `trips` (DB v2), Ansicht `features/calendar` (Ansicht in localStorage `fangpunkt.calendarView`, „Heute“-Knopf). Export in den Handy-Kalender: `domain/ics.ts` (RFC 5545, Zeiten in UTC), Download `features/calendar/exportIcs.ts`.
- Amtliche Warnungen (DWD über Bright Sky, Freigabe Nutzer 2026-10-23): Logik `domain/alerts.ts`, Port `ports/alerts.ts`, Adapter `adapters/brightSky.ts`, Laden `features/weather/useAlerts.ts`, Anzeige `features/weather/AlertsList.tsx` (Wetter-Seite oben, Angeltermine). E2E-Fixture antwortet für `api.brightsky.dev` „keine Warnungen“.
- Pegel (PEGELONLINE, Variante A, Freigabe 2026-10-23): Logik `domain/gauges.ts`, Port `ports/gauges.ts`, Adapter `adapters/pegelonline.ts`, Laden `features/weather/useGauge.ts` (ganze Stationsliste, 30 min Zwischenspeicher, keine Position übertragen), Anzeige `features/weather/GaugeCard.tsx`. Wasserstand ist keine Wassertiefe – immer dazuschreiben. Landespegel NRW (Variante B1): Adapter `adapters/hygonNrw.ts` (OpenHygon-Tagesdatei, ZIP mit fflate), Auswertung `summarizeHygon`, nur bei Ort in NRW (`useStateResolution`), Zwischenspeicher 6 h; Daten nennen kein Gewässer, nur das Einzugsgebiet. Pegel am Fang: `Catch.gauge` (`GaugeSnapshotSchema`, Auswahl/Messwert rein in `domain/gauges.ts`), Dienst `data/gaugeService.ts`, Hintergrund `features/weather/GaugeSync.tsx` (an `weatherEnabled` gekoppelt), Anzeige `CatchGauge.tsx`, Auswertung „Bisse nach Pegellage“ in `biteAnalysis.ts`. `none` wird gespeichert; „Reihe noch nicht da“ bleibt offen.
- Neuigkeiten (Wunsch Nutzer 2026-10-25): **Bei jeder für Nutzer sichtbaren neuen Funktion einen Eintrag in `app/src/i18n/changelog.ts` ergänzen** (neuester zuerst, ID = Datum `JJJJ-MM-TT`, am selben Tag `-2` …; kurze Sätze „Stichwort: Text“). Fenster „Neu in Fangpunkt“ `features/whatsNew/WhatsNew.tsx` zeigt ungesehene Einträge einmal nach dem Update (Logik `domain/whatsNew.ts`, Stand in Einstellung `lastSeenChangelog`; neue Installation ohne Fenster), nachlesbar unter Mehr → Über. In E2E nur mit `localStorage['fangpunkt.e2e.whatsNew']='1'`.
- Köder-Favoriten: Logik rein in `domain/baitPreset.ts` + `applyPreset`/`baitFields` in `domain/catchDraft.ts`, Verwaltung `features/baits` (`/mehr/koeder`).
- Session-Rückblick (Wunsch Nutzer 2026-10-23): Route `domain/track.ts` (Annahme/Verwerfen, Strecke, Vereinfachung, Wiedergabe), Tabelle `tracks` (DB v3, `track-<sessionId>`), Dienst `data/trackService.ts`, ein Standort-Zuhörer `features/sessions/tracking/SessionTracker.tsx` (Status `trackStatus.ts`, Anzeige `TrackingStatus.tsx`, Einstellung `trackSessions`). Rückblick `/fangbuch/sessions/:id/rueckblick` (`features/sessions/review`, natives dialog), Karte `ReviewMap.tsx` (MapLibre, lazy), Kennzahlen rein in `domain/sessionReview.ts`. Ereignisse = Fangbuch-Einträge der Session. Keine Hintergrund-Aufzeichnung in der PWA – Lücken nie verbinden.
- Session-Pausen: Logik `domain/session.ts` (`activeMs`, `pauseIssue` – auch im SessionSchema), Dienst `data/sessionService.ts` (pause/resume/addPause/removePause), Ansicht `features/sessions`.
- Rechts-Warnung: Landesgrenzen `states.json` aus der Pipeline (Geometrie gemeinsam `app/src/domain/geo.ts`), Prüfung `domain/regulationCheck.ts`, Anzeige `features/law/LawCheckPanel.tsx` (Formular + Eintrag). Warnt nur, blockiert nie (Entscheidung Nutzer 2026-10-22).
- CSV-Export: Baustein `domain/csv.ts` (Zahlen als Zahl übergeben, Text wird gegen Formeln entschärft), Spalten `features/backup/catchCsv.ts`.
- Fangbuch nach Gewässern: Gruppierung `domain/waterGroups.ts` (200 m für unbekannte), Reiter `features/catches/WaterTabs.tsx`, Ort-Nachtrag und Umbenennen `data/waterPlaceService.ts`. Eigene Namen nur an unbenannten Gewässern.
- Heatmap: Farben Blau (wenige) → Türkis → Grün → Gelb → Orange → Rot (sehr viele), Legende `.heatScale` gleich. Ebene `fp-catch-heat` in `features/map/mapLayers.ts` (`setHeatmap` blendet Fang-Symbole und Zahlenkreise aus; Deckkraft fest, Radius/Intensität wachsen mit dem Zoom), Umschalter in `MapView.tsx` (localStorage `fangpunkt.heatmap`).
- Datenschutzseite `features/about/PrivacyPage.tsx` (`/mehr/datenschutz`): neue Fremdserver nur zusammen mit Eintrag dort und in `privacy.spec.ts` (ALLOWED_EXTERNAL).
- Bereich „Wetter“ (`/wetter`, 5. Leistenpunkt): Vorhersage rein in `domain/forecast.ts`, Port `ports/forecast.ts`, Adapter `openMeteoForecast` (api.open-meteo.com, `timeformat=unixtime`), Ansicht `features/weather/WeatherPage.tsx`. Respektiert `weatherEnabled`.
- Statistik: Logik rein in `app/src/domain/stats.ts` (Mindestmengen, DATA_MODEL §9), Ansicht `app/src/features/stats`.
- Fotos: `lib/processPhoto.ts` (Neu-Kodierung entfernt EXIF), Speichern nur über `data/catchService.ts` (eine Transaktion mit dem Fang).
- Fangbuch: `app/src/features/catches`, Formularlogik rein in `app/src/domain/catchDraft.ts`. IDs immer über `domain/id.ts` (`crypto.randomUUID` fehlt außerhalb sicherer Kontexte).
- iOS-26-Homescreen-App: Anzeigefläche um die Statusleiste zu kurz (dunkler Streifen unten, WebKit 301108). Abhilfe in `design/base.css` (`html` min-height bei `display-mode: standalone`); `.shell` ist `position: fixed; inset: 0`. Der frühere 1-px-Scroll-Trick half nicht (Nutzer 2026-10-22).
- „Fang erfassen“: kein sichtbarer Hinweistext und kein Fadenkreuz (Wunsch Nutzer 2026-10-22); Hinweis nur für Screenreader, „Kartenmitte“ erscheint erst bei Tastaturfokus (mit Fadenkreuz).
- Hinweise (Toast): `design/components/Toast.tsx` blendet sich mit `onDismiss` selbst aus (1,5 s mit Aktion und als reine Info, Wunsch Nutzer; Pause bei Fokus/Finger), kompakte Glas-Kapsel. Keine eigenen Timer in Seiten.
- Glas-Look: untere Leiste und Kartenknöpfe (Standort, Heatmap, Legende, Session, Fang, Genauigkeit, OSM-Vermerk) durchsichtig; Suchleiste bleibt deckend (Wunsch Nutzer 2026-10-22).
- Untere Leiste: schwebende, durchsichtige Kapsel (mobil, `app/src/app/AppShell.module.css`); der Inhalt läuft darunter. Glas-Linse beim Wischen: Geometrie `app/src/app/navLens.ts`, Zeiger in `AppShell.tsx` (nur Touch/Stift; ein Tipp bleibt ein Link-Klick). OSM-Vermerk an der Karte klappt nach 5 s/Verschieben ein, darf aber nie ganz weg (OSMF). Alles, was unten fest oder klebend sitzt, rechnet `var(--nav-clearance)` ein (in Dialogen 0). Die Sicherungs-Erinnerung schwebt als Glas-Kapsel über der Leiste und setzt `--reminder-h`; Kartenknöpfe (`--map-bottom`), Seiten-Padding und Toast rechnen sie ein.
- Karte: `app/src/features/map`. Auf den Standort gezoomt wird nur einmal pro App-Start (`centeredThisLaunch`); nach Seitenwechsel bleibt die Ansicht, zurück über den Knopf „Zu meinem Standort“ (Wunsch Nutzer 2026-10-23). E2E-Tests dürfen OpenFreeMap nicht abrufen (`page.route` auf lokalen Teststil). Auf eigene Symbole erst tippen, wenn sie gerendert sind (Symbolplatzierung ist verzögert).
- Datenschicht: `app/src/data` (Dexie), Fachlogik `app/src/domain` (rein, ohne DB). Tests der Datenschicht laufen mit `// @vitest-environment node` + fake-indexeddb (jsdom-Blob ist unvollständig).
- App liegt in `app/` (pnpm-Workspace mit `tools/*`). Marken-Master: `app/src/design/brand/fish.json` → nach Änderungen `pnpm icons`.
- Gewässer-Pipeline: `tools/water-pipeline` (Doku dort); Deutschland-Lauf nur über den Actions-Workflow „Gewässerdaten erzeugen“ (Overpass und Geofabrik sind in der Cloud-Umgebung gesperrt). Nur tippecanoe ≥ 2.55 (2.49 aus Ubuntu verliert Objekte und vertauscht IDs, DATA_SOURCES §10.4). Die Prüfung in Schritt 5 (`src/verify.ts`) nie entfernen oder lockern.
- Marketing (Social Media) liegt getrennt in `marketing/` (Doku `marketing/README.md`); wird nicht gebaut. Grafiken nur aus dem Fisch-Master erzeugen (`marketing/tools/render.mjs`), Screenshots nur von der echten App mit Kennzeichnung „Beispieldaten“. Nur vorhandene Funktionen bewerben (keine Tiefen-/Offline-Karten).
- Rechtsinhalte zuerst nur für **NRW** (E7).
- Altprojekte `g5v4yjg24g-eng/angelkarte` und `g5v4yjg24g-eng/angelkarte-hohendeicher-see` sind **nur Referenz**. Nie verändern, nie Code oder Daten 1:1 kopieren (insbesondere nicht `tiefen.js`/`zonen.js`, Lizenz ungeklärt).

## Sprache
- UI-Texte, Doku und Commit-Nachrichten: **Deutsch**. Code-Bezeichner: Englisch.
- UI-Texte zentral in `app/src/i18n/de.ts`, nicht verstreut im JSX.

## Architekturregeln
- Stack: Vite, React, TypeScript strict, Dexie (IndexedDB), Zod, MapLibre GL JS, PMTiles, vite-plugin-pwa, Vitest, Playwright. Neue Abhängigkeiten nur mit Begründung im PR-Text.
- Schichten: `features → domain | data | ports`. `domain/` ist reine Logik ohne Imports aus React, Dexie oder `adapters/`.
- Externe Anbieter (Basiskarte, Tiefen, Wetter, Suche, Fischbestimmung) **nur** über `ports/` + `adapters/`. Kein direkter `fetch` auf Fremddienste aus Komponenten.
- Jede persistente Entität hat ein Zod-Schema; Formulare, Import und Migrationen nutzen dasselbe Schema.
- Keine `innerHTML`/`dangerouslySetInnerHTML` mit Daten.
- DB-Schemaänderungen nur mit Dexie-Migration **und** Migrationstest.

## Datenregeln (nicht verhandelbar)
- **Nichts erfinden:** keine Gewässerdaten, Koordinaten, Tiefen, Arten, Angelrechte, Vorschriften, Preise, Lizenzen oder API-Fähigkeiten. Fehlt etwas → `unknown` anzeigen und offene Prüfung in DATA_SOURCES.md eintragen.
- Jede Fremdangabe trägt `SourceRef` (Quelle, Lizenz, Datenstand).
- Tiefen: Button nur bei `DepthCoverage.status === 'available'`. Keine selbst interpolierten oder geschätzten Tiefen als Messung.
- Recht: Jede Regel braucht `basisRef` (Paragraf) und eine Quelle aus `legalBasis`. Immer der Hinweis „keine Rechtsauskunft".
- Keine Laufzeit-Massenabfragen an Overpass, Nominatim oder OSM-Kachelserver. Gewässer und Suche kommen aus der eigenen Pipeline (`tools/water-pipeline`).
- „Offline verfügbar" nur behaupten, wenn ein E2E-Test es belegt.
- Kennzeichnung in Doku: **[V]** verifiziert (mit Link und Datum), **[A]** Annahme, **[O]** offen.

## Datenschutz
- Persönliche Daten bleiben lokal. Kein Analytics/Tracking ohne ausdrückliche Entscheidung. Entschieden (Nutzer 2026-10-24): anonyme Nutzungszählung über GoatCounter – nur Bereichspfade ohne IDs (`domain/usage.ts`), Port `ports/usage.ts`, Adapter `adapters/goatCounter.ts`, `features/usage/UsageTracker.tsx`, Einstellung `usageCount` (Standard an), Code über Repository-Variable `GOATCOUNTER_CODE` (Pages-Workflow); ohne Code wird nichts gesendet.
- Standort: beim Kartenstart standardmäßig an (Entscheidung Nutzer 2026-10-22, Einstellung `locateOnStart`, Browser fragt um Erlaubnis); verlässt das Gerät nur gerundet (Wetter).
- Foto-EXIF beim Speichern entfernen.

## Arbeitsweise
- Kleine, überprüfbare Schritte; ein Meilenstein-Teilziel pro PR.
- Vor dem Abschluss einer Aufgabe: `pnpm typecheck && pnpm lint && pnpm test` (und `pnpm e2e` bei UI-Änderungen). Ergebnisse ehrlich berichten, auch Fehler.
- Bei Entscheidungen mit Wirkung auf Architektur, Kosten, Datenschutz oder Datenverfügbarkeit: Optionen nennen, Empfehlung geben, Freigabe abwarten.
- UI immer auch bei 390 px Breite und im Dunkelmodus prüfen; `prefers-reduced-motion` beachten.
- Leere, Lade- und Fehlerzustände sind Teil jeder Ansicht, nicht Nacharbeit.

## Befehle (im Repo-Root)
```
pnpm install
pnpm dev          # Entwicklungsserver
pnpm build        # Produktionsbuild inkl. SW
pnpm typecheck
pnpm lint
pnpm test         # Vitest
pnpm e2e          # Playwright gegen den Produktionsbuild (Chromium vorinstalliert; @playwright/test bleibt auf 1.56.1 = chromium-1194)
pnpm icons        # App-Icons aus dem Marken-Master erzeugen
pnpm validate:data
```

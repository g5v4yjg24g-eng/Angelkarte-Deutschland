# CLAUDE.md – Projektregeln

Deutschlandweite Angel-App als PWA namens **„Fangpunkt"** (Arbeitsname, E5). Nicht kommerziell (E3).
Planungsdokumente im Repo-Root: `PLAN.md`, `ARCHITECTURE.md`, `DATA_SOURCES.md`, `DATA_MODEL.md`, `TEST_PLAN.md`. **Vor jeder größeren Änderung lesen.** Bei Abweichungen das Dokument im selben PR aktualisieren.

## Projektstatus
- Phase: **M7.1 umgesetzt** (PLAN.md §4): Fangbuch, Sessions, Statistik, Rechtsstruktur. Offen: M7.2 NRW-Inhalt aus dem amtlichen Text.
- Recht: Schema/Logik `app/src/domain/regulations.ts`, Daten `app/data/regulations/<KÜRZEL>.json` (nur aus dem amtlichen Text), Ansicht `app/src/features/law`. `draft` nur in der Prüfansicht `?pruefung=1`. Sichtbar (`partial`, vom Nutzer gegengeprüft 2026-10-22): alle Länder außer NW, Fischereischein-Regeln überall erfasst. Offen (zurückgestellt): Berlin Landesfischereischeingesetz (vom Nutzer nicht auffindbar), Abgabehöhen-Verordnungen TH/SH/ST/RP, SH Urlauberfischereischein. Ohne Daten: NW (recht.nrw.de in Wartung, Nutzer schickt PDF später). PDF-Text vor dem Lesen von Seitenvorschüben (`\f`) befreien. Übersichtsseiten von Behörden ohne Fundstellen sind keine Quelle. Texte gesperrter Portale schickt der Nutzer als PDF. `import.meta.glob` ohne Typparameter aufrufen (mit `glob<…>(` liefert Vite `{}`).
- Wetter am Fang: Fachlogik `domain/weather.ts`, Port `ports/weather.ts`, Adapter `adapters/openMeteo.ts` (Historical-Forecast-API, ab 2022), Nachladen `data/weatherService.ts` + `features/weather/WeatherSync.tsx`. Einstellung `weatherEnabled` standardmäßig an (Entscheidung Nutzer 2026-10-22); Koordinaten nur gerundet (3 Stellen). E2E mockt `historical-forecast-api.open-meteo.com` (`weather.spec.ts`).
- Köder-Favoriten: Logik rein in `domain/baitPreset.ts` + `applyPreset`/`baitFields` in `domain/catchDraft.ts`, Verwaltung `features/baits` (`/mehr/koeder`).
- Session-Pausen: Logik `domain/session.ts` (`activeMs`, `pauseIssue` – auch im SessionSchema), Dienst `data/sessionService.ts` (pause/resume/addPause/removePause), Ansicht `features/sessions`.
- Rechts-Warnung: Landesgrenzen `states.json` aus der Pipeline (Geometrie gemeinsam `app/src/domain/geo.ts`), Prüfung `domain/regulationCheck.ts`, Anzeige `features/law/LawCheckPanel.tsx` (Formular + Eintrag). Warnt nur, blockiert nie (Entscheidung Nutzer 2026-10-22).
- CSV-Export: Baustein `domain/csv.ts` (Zahlen als Zahl übergeben, Text wird gegen Formeln entschärft), Spalten `features/backup/catchCsv.ts`.
- Heatmap: Ebene `fp-catch-heat` in `features/map/mapLayers.ts` (`setHeatmap`), Umschalter in `MapView.tsx` (localStorage `fangpunkt.heatmap`).
- Statistik: Logik rein in `app/src/domain/stats.ts` (Mindestmengen, DATA_MODEL §9), Ansicht `app/src/features/stats`.
- Fotos: `lib/processPhoto.ts` (Neu-Kodierung entfernt EXIF), Speichern nur über `data/catchService.ts` (eine Transaktion mit dem Fang).
- Fangbuch: `app/src/features/catches`, Formularlogik rein in `app/src/domain/catchDraft.ts`. IDs immer über `domain/id.ts` (`crypto.randomUUID` fehlt außerhalb sicherer Kontexte).
- Karte: `app/src/features/map`. E2E-Tests dürfen OpenFreeMap nicht abrufen (`page.route` auf lokalen Teststil). Auf eigene Symbole erst tippen, wenn sie gerendert sind (Symbolplatzierung ist verzögert).
- Datenschicht: `app/src/data` (Dexie), Fachlogik `app/src/domain` (rein, ohne DB). Tests der Datenschicht laufen mit `// @vitest-environment node` + fake-indexeddb (jsdom-Blob ist unvollständig).
- App liegt in `app/` (pnpm-Workspace mit `tools/*`). Marken-Master: `app/src/design/brand/fish.json` → nach Änderungen `pnpm icons`.
- Gewässer-Pipeline: `tools/water-pipeline` (Doku dort); Deutschland-Lauf nur über den Actions-Workflow „Gewässerdaten erzeugen“ (Overpass und Geofabrik sind in der Cloud-Umgebung gesperrt). Nur tippecanoe ≥ 2.55 (2.49 aus Ubuntu verliert Objekte und vertauscht IDs, DATA_SOURCES §10.4). Die Prüfung in Schritt 5 (`src/verify.ts`) nie entfernen oder lockern.
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
- Persönliche Daten bleiben lokal. Kein Analytics/Tracking ohne ausdrückliche Entscheidung.
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

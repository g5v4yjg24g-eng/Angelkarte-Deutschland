# CLAUDE.md – Projektregeln

Deutschlandweite Angel-App als PWA namens **„Fangpunkt"** (Arbeitsname, E5). Nicht kommerziell (E3).
Planungsdokumente im Repo-Root: `PLAN.md`, `ARCHITECTURE.md`, `DATA_SOURCES.md`, `DATA_MODEL.md`, `TEST_PLAN.md`. **Vor jeder größeren Änderung lesen.** Bei Abweichungen das Dokument im selben PR aktualisieren.

## Projektstatus
- Phase: **M1 abgeschlossen** (PLAN.md §4). Nächster Schritt M2 nach Freigabe.
- App liegt in `app/` (pnpm-Workspace mit `tools/*`). Marken-Master: `app/src/design/brand/fish.json` → nach Änderungen `pnpm icons`.
- Gewässer-Pipeline: `tools/water-pipeline` (Doku dort). Kein Feature-`tippecanoe.minzoom` verwenden (Bug, siehe DATA_SOURCES §10.1); die Vollständigkeitsprüfung in `run.sh` nicht entfernen.
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
- Standort nur nach Nutzeraktion; an Dritte nur gerundet (Wetter).
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

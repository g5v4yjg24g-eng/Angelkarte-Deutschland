# PLAN – Angel-App Deutschland (Neustart als PWA)

Stand: 2026-10-21 · Status: **M4 abgeschlossen** · nächster Schritt M5 (Fangbuch) nach Freigabe

Verwandte Dokumente: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATA_SOURCES.md](DATA_SOURCES.md) · [DATA_MODEL.md](DATA_MODEL.md) · [TEST_PLAN.md](TEST_PLAN.md) · [CLAUDE.md](CLAUDE.md)

Kennzeichnung in allen Dokumenten:
- **[V]** verifiziert (Quelle geprüft am 2026-10-21, Link im Dokument)
- **[A]** begründete Annahme
- **[O]** offene Prüfung, muss vor dem genannten Meilenstein geklärt sein

---

## 1. Ausgangslage

### 1.1 Neues Projekt
- Repository `g5v4yjg24g-eng/Angelkarte-Deutschland` ist **leer** (keine Commits, keine Dateien) **[V]**.
- In der Umgebung vorhanden: Node 22.22, npm 10.9, pnpm 10.28 **[V]**.
- Es gibt also nichts, was überschrieben werden könnte. Alle Planungsdokumente werden neu angelegt.

### 1.2 Altprojekte (nur gelesen, nicht verändert)
Geprüft wurden `g5v4yjg24g-eng/angelkarte` (De-Witt-See, NRW) und `g5v4yjg24g-eng/angelkarte-hohendeicher-see` (Hamburg). Beide sind Klone desselben Codes: Vanilla-JS ohne Build, eine `index.html` mit rund 440 Zeilen (stark minifiziert), Leaflet über CDN, IndexedDB, Service Worker.

**Vorhandene Funktionen und Nutzerabläufe (fachliche Referenz):**

| Bereich | Altes Verhalten | Bewertung für den Neustart |
|---|---|---|
| Karte | Leaflet + OSM-Rasterkacheln, Seeumriss zur Laufzeit via Overpass/Nominatim | **Ersetzen.** Laufzeitabfragen an Overpass/Nominatim für jedes Gewässer sind laut Nutzungsrichtlinien ungeeignet (siehe DATA_SOURCES §2). |
| Tipp auf Karte | Öffnet Dialog mit Typwahl: Angelplatz, Fang, Fischkontakt, Angelsteg | **Übernehmen, verbessern:** erst Bottom Sheet mit Typwahl, dann typspezifisches Formular. |
| Schnellerfassung „Hier" | Eintrag an GPS-Position, Wetter wird nachgeladen | **Übernehmen** (P1). |
| Ergebnisarten | `bite`, `lost_hooked`, `lost_drill`, `caught`, `seen` | **Übernehmen und schärfen:** Fang / Fischkontakt (mit Untertyp) / Fehlbiss / Beobachtung. |
| Fangformular | ca. 35 Felder in 5 aufklappbaren Gruppen (Größe, Methode/Köder, Wetter/Wasser, Sonstiges) | **Übernehmen, entschlacken:** Pflicht nur Typ + Zeit + Position; alles andere optional und progressiv. |
| Köder-Favoriten | In `meta` gespeichert | **Übernehmen** als eigene Entität `BaitPreset` (P1). |
| Foto | Als JPEG-DataURL (1024 px) **im Fang-Datensatz** | **Ändern:** Blob in eigener Tabelle; DataURLs blähen Datensätze und Exporte auf. |
| Ausflug/Session | Start/Stopp, Einträge erhalten `sessionId` | **Übernehmen.** |
| Heatmap | Eigene Kontakte, Warnung bei < 30 Punkten | **Später (P2)**; die Warnung vor Scheinmustern ist gut und bleibt. |
| Statistik | KPIs, Fischarten, Fangentwicklung, Effizienz (Fänge/h), Rekorde, Mindestdatenmengen | **Fachlogik übernehmen** (Mindestmengen, keine Raten bei < 1 h). Darstellung neu. |
| Wetter/Beißfenster | Open-Meteo, Wetter je Eintrag/Session, „persönliche Beißfenster" | Wetter je Eintrag: **P1**. Beißfenster-Auswertung: **P3**, wegen Irreführungsgefahr bei wenigen Daten. |
| Angelkalender | Termine planen, Jahres- und Tagesübersicht | **Später (P3).** Nicht im Auftrag genannt. |
| Recht | NRW bzw. Hamburg fest eingebaut, mit Quelle, Prüfdatum und 180-Tage-Veraltungswarnung | **Konzept übernehmen** (Quelle + Prüfstand + Status). Inhalte **neu prüfen**, nicht ungeprüft kopieren. |
| Tiefenkarte (HH) | Tiefenlinien 1–16 m aus der ArcGIS-Karte des Anglerverbands Hamburg, fest eingebettet | **Nicht übernehmen**, bis die Nutzungsrechte geklärt sind (siehe Risiko R4). |
| Angelzonen (HH) | Uferabschnitte erlaubt/verboten aus derselben Quelle | Wie oben. Fachlich wertvoll (Typ-4-Information). |
| Backup | JSON- und CSV-Export, Import überschreibt gleiche IDs **ohne Vorschau**, Erinnerung ab 5 Änderungen oder 14 Tagen | **Übernehmen, Import absichern** (Validierung, Vorschau, Konfliktwahl). |
| Theme | Hell/Dunkel manuell | Übernehmen. Zusätzlich Systemeinstellung als Standard. |
| Tests | 2 Playwright-E2E-Skripte (Statistik, Wetter) ohne Test-Runner | Ansatz übernehmen, mit Vitest + Playwright Test neu aufsetzen. |

**Bekannte Schwächen des Altprojekts, die der Neustart vermeiden muss:**
1. Gewässer fest kodiert (`LAKES`), Zuordnung über Namensmuster („Groß"/„Klein").
2. Monolithische Datei, globale Funktionen (`window.editE`), HTML-Strings mit `onclick`.
3. Fotos als Base64 in Datensätzen.
4. Import überschreibt gleiche IDs stillschweigend.
5. Service Worker cacht OSM-Kacheln bis 3 000 Stück und Eigenressourcen mit `no-store`-Netzabruf. Das ist zulässig, solange nur betrachtete Kacheln gecacht werden, aber es gibt keine Versionierung und keinen Update-Hinweis.
6. Drittdaten (Tiefen, Zonen) eingebettet, ohne geklärte Lizenz.

---

## 2. Anforderungen

### 2.1 Bestätigte Anforderungen (aus dem Auftrag)
- PWA: installierbar, responsiv, eigenes Icon, Intro-Animation nur bei Kaltstart, `prefers-reduced-motion`.
- Deutschlandweite Karte: Zoom und Verschieben, Suche nach Gewässern und Orten, Gewässerauswahl, Details, eigene Markierungen, Standort nur nach Freigabe, Filter.
- Gewässerdaten in vier Qualitätsstufen (geografisch / Details / Angelinfo / rechtlich geklärt). Nichts erfinden.
- Tiefenkarten-Button nur bei tatsächlich vorhandenen Daten, mit austauschbarem Anbieter.
- Gewässerprofile mit Quellen, Stand und „unbekannt"-Zuständen.
- Markierungen per Tipp auf die Karte, ohne eigenen Menüpunkt; mindestens Angelstelle und Angelsteg.
- Fangbuch: Fang, Fischkontakt, Fehlbiss; Sessions; offline erfassbar.
- Statistik mit Filtern und ohne irreführende Kennzahlen.
- Rechtsstruktur für 16 Länder: Landesrecht getrennt von Gewässerregeln, Quellen und Prüfstand.
- Offline: IndexedDB, JSON-Export und -Import mit Validierung, Backup-Erinnerung.
- Keine Konten und keine Cloud-Sync ohne Bewertung. Fischbestimmung nur architektonisch vorbereiten.
- TypeScript, modular, getestet auf Smartphone und PC.

### 2.2 Technische Annahmen [A]
- A1: Die App ist zunächst **nicht kommerziell** (keine Werbung, kein Abo). Davon hängt die Nutzbarkeit von Open-Meteo Free ab (siehe DATA_SOURCES §6). → **Bestätigt (E3).**
- A2: Erster Stand **ohne eigenes Backend**: statisches Hosting plus vorab erzeugte Datenpakete. Alle persönlichen Daten bleiben auf dem Gerät.
- A3: Zielgeräte sind aktuelles iOS Safari (≥ 17), Android Chrome und Desktop Chrome/Firefox/Safari/Edge.
- A4: Die Nutzerzahl ist zunächst klein (< 1 000 aktive Nutzer). Kostenschätzungen beziehen sich darauf.
- A5: Deutsch ist die einzige Sprache im MVP. Texte werden trotzdem zentral gehalten (i18n-fähig).

### 2.3 Offene Fragen an dich → siehe §6 „Entscheidungen"

---

## 3. Prioritäten

- **P0 – MVP:** Ohne diese Funktionen ist die App nicht sinnvoll nutzbar.
- **P1:** Erster Ausbau direkt nach dem MVP.
- **P2/P3:** Später, abhängig von Daten, Lizenzen oder Bedarf.

| Funktion | Prio | Begründung |
|---|---|---|
| App-Gerüst, Designsystem, Intro, Icon, PWA-Install/Update | P0 | Basis für alles |
| Lokale DB, Datenmodell, Migrationen, Export/Import | P0 | Datenverlust vermeiden, bevor Nutzer Daten eingeben |
| Deutschlandkarte (Vektor-Basiskarte) + Standort | P0 | Kernfunktion |
| Gewässer-Layer und -Suche (OSM-Pipeline, Stufe 1) | P0 | Kern; ohne ihn keine Profile |
| Gewässerprofil (Stufe 1 + eigene Daten) | P0 | |
| Markierungen per Tipp (Angelstelle, Steg, Sonstiges) | P0 | |
| Fangbuch (Fang/Kontakt/Fehlbiss), Foto, Sessions | P0 | |
| Statistik-Basis (Kennzahlen, Arten, Gewässer, Köder, Verlauf, Filter) | P0 | Im Auftrag als besonders wichtig markiert |
| Recht: Struktur + Landesrecht für die ersten 2–3 Länder | P0 | Struktur jetzt; Inhalte wachsen pro Land |
| Wetter am Fang (online, automatisch nachgeladen) | P1 | Open-Meteo Free (nicht kommerziell, E3) |
| Köder-Favoriten, Schnellerfassung „Hier" | P1 | |
| Recht: restliche Bundesländer | P1 | Redaktioneller Aufwand, siehe §5 M8 |
| Session-Vergleich, Rekorde | P1 | |
| Fischarten pro Gewässer (Monitoring-Nachweise, Stufe 2) | P2 | Datenaufbereitung nötig (DATA_SOURCES §4) |
| Tiefenkarten (erste lizenzierte Quelle) | P2 | Lizenzklärung nötig |
| Offline-Kartenregionen | P2 | Eigene PMTiles-Hosting-Infrastruktur nötig |
| Heatmap, CSV-Export | P2 | |
| Gewässerbezogene Regeln / Angelzonen (Stufe 4) | P3 | Kaum offene Daten; Kooperationen nötig |
| Angelkalender, Beißfenster-Analyse | P3 | |
| Fischbestimmung per Foto | P3 | Nur Schnittstelle vorbereiten |
| Konten und Cloud-Sync | P3 | Erst bei Bedarf (siehe ARCHITECTURE §9) |

---

## 4. Meilensteine

Jeder Meilenstein endet mit einem **Abnahmetest** (Details in TEST_PLAN.md) und einem lauffähigen Stand auf der Vorschau-URL.

```
M0 Entscheidungen ──► M1 Gerüst ──► M2 Lokale Daten ──► M5 Fangbuch ──► M6 Statistik
                         │                 │                 ▲
                         └──► M3 Karte ──► M4 Gewässer ──────┘
                                              │
                                              ├──► M7 Recht (Struktur) ──► M8 Recht (16 Länder)
                                              └──► M9 Tiefen-Spike ──► M10 Offline-Karten
M11 Härtung/Release (nach M1–M7)
```

### M0 – Entscheidungen und Spikes (vor Code) — ✅ erledigt 2026-10-21
- ✅ Entscheidungen E1–E9 (§6).
- ✅ **Spike S1:** Gewässer-Pipeline mit **NRW** (Geofabrik/Bremen war in der Umgebung gesperrt). Ergebnis: 163 294 Gewässer, 20,9 MB PMTiles, Hochrechnung DE 85–220 MB. Details DATA_SOURCES §10.1.
- ✅ **Spike S2:** OpenFreeMap + MapLibre + eigenes Overlay headless gemessen. Details DATA_SOURCES §10.2.
- ✅ **S1b:** voller Deutschland-Lauf: 157 MB PMTiles, Hochrechnung bestätigt. Details DATA_SOURCES §10.4.
- ✅ **S2b:** Gerätetest durch dich (2026-10-21): Bedienung, Tempo und Darstellung in Ordnung; Kartenstil daraufhin geändert (hell `liberty`, dunkel eigene Farben nach deiner Vorlage), DATA_SOURCES §10.2.
- *Abnahme:* Entscheidungen in PLAN.md dokumentiert; Messwerte S1 und S2 in DATA_SOURCES.md eingetragen.

### M1 – Projektgerüst, Designsystem, PWA-Hülle — ✅ erledigt 2026-10-21 (Branch `m1/app-geruest`)
Abhängig von: M0
- ✅ pnpm-Workspace (`app/`, `tools/*`); Vite 8, React 19, TypeScript 6.0 strict, ESLint mit Schichtregeln, Prettier, Vitest, Playwright; CI-Workflow (`.github/workflows/ci.yml`).
- ✅ Design-Tokens „Tiefwasser" hell/dunkel mit **automatischem Kontrasttest** (34 Farbpaare, WCAG AA); Schriften Inter + Fraunces selbst gehostet (nur latin/latin-ext).
- ✅ Basiskomponenten: Button, IconButton, EmptyState, Badge, ListLink, SegmentedControl, Toast, Page/Section. *Sheet, Dialog und Field folgen, wenn sie gebraucht werden (M3/M5).*
- ✅ Fisch-Logo als **ein Master** (`app/src/design/brand/fish.json`) → React-Komponente, Intro und alle Icons (`pnpm icons`: 192, 512, maskable 512, Apple-Touch 180, favicon.svg).
- ✅ Intro inline in `index.html`: nur beim Kaltstart, Mindestdauer 750 ms + 250 ms Ausblenden, per Tipp überspringbar, Reduced Motion: statisch (200 ms), Sicherheitsnetz 8 s.
- ✅ App-Shell: Karte · Fangbuch · Statistik · Mehr (unten auf dem Handy, Schiene links ab 900 px), Einstellungen (Theme System/Hell/Dunkel), Info & Quellen, 404, Fehlergrenze, Offline-Hinweis.
- ✅ vite-plugin-pwa: Precache (544 KB), Update-Hinweis „Jetzt aktualisieren / Später", Navigations-Fallback offline.
- ✅ Vorschau-Workflow für GitHub Pages (`.github/workflows/pages.yml`), aktiv sobald Pages auf „GitHub Actions" steht.
- *Abnahme (Ergebnisse):* 47 Unit-Tests, 24 E2E-Tests (mobil + Desktop) grün, darunter PWA-1/2/3/4/6, axe ohne ernste Verstöße hell/dunkel, kein horizontales Scrollen bei 390 px, Touch-Ziele ≥ 44 px. Lighthouse mobil: Performance 96, Barrierefreiheit 100, Best Practices 100, LCP 2,4 s. JS 105 KB gzip.
- *Offen:* PWA-5 (Update-Hinweis bei neuer Version) nur manuell geprüft, nicht automatisiert. Lighthouse 12 hat keine PWA-Kategorie mehr; Installierbarkeit ist über PWA-1 (Manifest, Icons) und den aktiven Service Worker (PWA-6) belegt. Test auf echten Geräten steht aus (S2b).

### M2 – Lokale Datenhaltung — ✅ erledigt 2026-10-21 (Branch `m2/lokale-daten`)
Abhängig von: M1
- ✅ Dexie-Schema v1, Repositories (Validierung, Revision, Papierkorb 30 Tage), Zod-Schemas, Migrationsgerüst mit Test.
- ✅ `navigator.storage.persist()` auf Knopfdruck mit Erklärung; Speicheranzeige.
- ✅ Export als ZIP mit Fotos oder JSON ohne Fotos, mit SHA-256-Prüfsumme. Import mit Prüfung je Datensatz, Vorschau (neu/gleich/abweichend), drei Strategien, eine Transaktion (alles oder nichts), automatischer Snapshot und „Rückgängig".
- ✅ Importer für die Alt-App (E9) inkl. Fotos, Sessions, Stegen und Angelplätzen; Originaldaten bleiben erhalten.
- ✅ Sicherungs-Erinnerung (ab 5 Änderungen oder nach 14 Tagen; „Später" = 3 Tage).
- *Abnahme (Ergebnisse):* 89 Unit-Tests, 28 E2E-Tests grün; Roundtrip identisch; 7 Arten kaputter/manipulierter Dateien abgelehnt ohne Datenänderung; Rollback bei Abbruch; 10 000 Einträge Export+Import < 10 s; Migration v1 → v2.
- *Offen:* BAK-7 mit einem **echten** Export der Alt-Apps prüfen (bitte Datei bereitstellen). Fangbuch zeigt bis M5 nur die Anzahl gespeicherter Einträge.

### M3 – Deutschlandkarte — ✅ erledigt 2026-10-21 (Branch `m3/karte`)
Abhängig von: M1
- ✅ MapLibre GL JS 6 (lazy geladen) mit OpenFreeMap über den Port `BasemapProvider`; Stil folgt dem Theme (seit M4: `liberty`, dunkel umgefärbt); **deutsche Beschriftung** (`name:de` vor `name`).
- ✅ Ohne Netz oder bei gestörtem Anbieter: schlichter Ersatzstil mit Hinweis; eigene Markierungen bleiben sichtbar und antippbar (MAP-5).
- ✅ Tipp auf die Karte → Sheet „Neu an dieser Stelle": Angelstelle, Angelsteg, Parkplatz, Zugang, Gefahrenstelle, Sonstige Markierung. Fang/Kontakt sichtbar als „folgt mit M5".
- ✅ Orte ansehen, bearbeiten (auch Art ändern), löschen mit „Rückgängig"; Fänge aus Sicherungen werden angezeigt und sind antippbar (Details, Bearbeiten ab M5).
- ✅ Symbolsystem: Form = Ortsart, Kreis = Fangereignis, jeweils mit eigenem Zeichen; Fänge gruppiert (Cluster mit Zahl), Antippen zoomt hinein; Legende.
- ✅ Standort erst nach Erklärung und Zustimmung, nur solange sichtbar, mit Genauigkeitskreis und verständlichen Fehlermeldungen (MAP-1/2).
- ✅ Tipp-Logik: bei überlappenden Symbolen gewinnt das nächstgelegene.
- *Abnahme (Ergebnisse):* 94 Unit-Tests, 42 E2E-Tests grün; Kartentests 4× wiederholt stabil (56/56). Start-Bundle 141 KB gzip, Karte 291 KB gzip nachgeladen; Kartenworker im Offline-Cache.
- *Gefundene und behobene Fehler:* verspätetes `close`-Ereignis des Dialogs schloss ein direkt danach geöffnetes Sheet; Erinnerungsleiste verschob die Karte während der Bedienung.
- *Offen:* 60 fps auf Mittelklasse-Android ist headless nicht messbar → Gerätetest S2b. Gewässer-Ebene folgt in M4.

### M4 – Gewässerbasis (Stufe 1) und Gewässerprofil — ✅ erledigt 2026-10-21 (Branch `m4/gewaesser`)
Abhängig von: M3, Spike S1
- ✅ Datenpipeline `tools/water-pipeline` (OSM-PBF → gefilterte Gewässer → PMTiles + Suchindex + Manifest mit Datenstand), reproduzierbar per Skript und als GitHub-Actions-Lauf „Gewässerdaten erzeugen" mit Veröffentlichung als Release `wasserdaten-*`.
- ✅ Prüfung jedes Objekts nach dem Kacheln (vorhanden **und** unveränderte Eigenschaften); tippecanoe ≥ 2.55 erzwungen, weil 2.49 Objekte verlor und IDs vertauschte (DATA_SOURCES §10.4).
- ✅ Grenzgewässer (Bodensee, Stettiner Haff u. a.) werden beim Bauen über eine Overpass-Abfrage vervollständigt (deine Entscheidung, Option A).
- ✅ Gewässer antippbar → Profil: Name, Typ, Fläche (aus Geometrie, gekennzeichnet), Lage (Gemeinde/Kreis/Land), Quelle OSM + Datenstand + Link, Tiefenkarte „nicht verfügbar" ohne Knopf, Rechtsstatus des Landes („in Arbeit, M7"), eigene Orte/Fänge am Gewässer, „Hier markieren". Hervorhebung des gewählten Gewässers.
- ✅ Suche nach Gewässern und Orten aus eigenem Index (kein Nominatim), Umlaut-tolerant, OSM-Zusatznamen (z. B. Möhnesee ↔ Möhnetalsperre), Sortierung nach Treffergüte, Bedeutung und Nähe.
- ✅ Kartenstil nach Gerätetest überarbeitet (hell `liberty`; dunkel petrolgrünes Land, sattblaues Wasser).
- *Abnahme (Ergebnisse):* Stichprobe WAT-2 automatisiert (`src/sample.ts`): **20/20** im Release-Lauf (Bodensee dank Grenzgewässer-Ergänzung). Release `wasserdaten-2026-10-21-5` live auf GitHub Pages, Range-Abrufe und Suche/Profil dort geprüft. 103 Unit-Tests und 51 E2E-Tests grün (ein Intro-Zeittest kippt gelegentlich unter Volllast, einzeln stabil). Datenstand im Profil sichtbar, Abdeckung in der Suche; fehlende Angaben als „unbekannt"/„keine geprüften Angaben".
- *Offen:* WAT-4 (Nachfolger bei weggefallener `wid`) wird mit dem ersten Datenpaket-Update fällig [O]. Fließgewässer zeigen nur den angetippten Abschnitt.

### M5 – Fangbuch und Sessions
Abhängig von: M2, M4
- Formular Fang / Kontakt / Fehlbiss mit progressiver Offenlegung; Fotos (Kompression, Blob-Speicher).
- Sessions: Start/Stopp, laufende Session in der Kopfzeile, automatische Zuordnung, nachträgliches Bearbeiten.
- Liste mit Filter und Suche, Detailansicht, Bearbeiten, Löschen mit Rückgängig.
- Gewässerzuordnung automatisch (Punkt-in-Polygon gegen geladene Gewässer), manuell änderbar.
- *Abnahme:* Erfassung komplett offline (Flugmodus) inklusive Foto; nach Neustart vorhanden.

### M6 – Statistik
Abhängig von: M5
- Kennzahlen, Arten, Gewässer, Köder/Methoden, Verlauf, Session-Vergleich; Filter für Zeitraum, Art und Gewässer.
- Regeln gegen Irreführung (Mindestmengen, Kontext „n = …", keine Raten bei < 1 h Angelzeit).
- *Abnahme:* Fixture-Datensätze mit bekannten Soll-Werten; leere und kleine Datenmengen zeigen erklärende Zustände; keine Anzeige von NaN, ∞ oder „undefined".

### M7 – Recht: Struktur und erste Länder
Abhängig von: M4
- Rechtsdaten-Schema, Validierungsskript, Veraltungslogik, Anzeige pro Land und im Gewässerprofil.
- Inhalte für **NRW** (E7), neu am amtlichen Text geprüft (Altprojekt-Stand 2026-10-18 nur als Ausgangspunkt).
- *Abnahme:* NRW-Datei mit Status `verified`; jede Regel hat Quelle, Paragraf, Prüfdatum; der Schema-Check in CI schlägt bei fehlender Quelle fehl; der Hinweis „keine Rechtsberatung" ist sichtbar.

### M8 – Recht: alle 16 Länder
Abhängig von: M7 · Aufwand redaktionell (≈ 0,5–1 Tag pro Land [A])
- Quellenrecherche je Land, Erfassung, Vier-Augen-Prüfung (du prüfst jede Landesdatei gegen den verlinkten amtlichen Text).
- *Abnahme:* 16 Landesdateien mit Status `verified` oder ausdrücklich `partial` und Liste fehlender Teile.

### M9 – Tiefenkarten-Spike und erste Quelle
Abhängig von: M4 und Klärung von R4/E6
- Provider-Schnittstelle `DepthProvider`; Status pro Gewässer `available | none | unknown`.
- Erste Quelle nur mit schriftlich geklärter Nutzung (siehe DATA_SOURCES §3).
- *Abnahme:* Der Button erscheint nur bei `available`; Tiefenmodus ist visuell eindeutig (eigene Legende, Banner „Tiefenkarte – Quelle …, nicht zur Navigation").

### M10 – Offline-Karten (optional)
Abhängig von: M3, E2-Variante „Self-Hosting"
- Regionen (z. B. Landkreis-Ausschnitt) als PMTiles im Cache Storage oder OPFS speichern; Speicherbedarf anzeigen.
- *Abnahme:* Region geladen → Flugmodus → Karte und Gewässer sichtbar. Erst danach darf die App „offline verfügbar" behaupten.

### M11 – Härtung und Release 1.0
Abhängig von: M1–M7
- Barrierefreiheit (axe, Tastatur, Screenreader-Stichprobe), Geräte-Matrix, Datenschutzerklärung, Impressum (falls öffentlich), Quellen- und Lizenzseite.
- *Abnahme:* TEST_PLAN §6 komplett grün.

---

## 5. Aufwand (grobe Schätzung) [A]

Gerechnet in Arbeitstagen mit Claude Code und deinem Review. Unsicherheit ±50 %.

| M | Tage |
|---|---|
| M0 | 1–2 |
| M1 | 3–4 |
| M2 | 3–4 (inkl. Alt-App-Import) |
| M3 | 2–3 |
| M4 | 4–6 (Pipeline ist der größte technische Brocken) |
| M5 | 4–5 |
| M6 | 3–4 |
| M7 | 2 + 1 pro Land |
| M8 | 8–16 (redaktionell, vor allem Prüfung durch dich) |
| M9 | 2 + Klärungszeit extern (unbekannt) |
| M10 | 3–5 |
| M11 | 2–3 |

---

## 6. Entscheidungen (getroffen am 2026-10-21)

| # | Frage | Entscheidung | Folgen |
|---|---|---|---|
| **E1** | Frontend-Stack | **React + Vite + TypeScript** | Begründung in ARCHITECTURE §2 |
| **E2** | Basiskarte | **OpenFreeMap für MVP, eigene Protomaps-PMTiles ab M10** | Anbieter per Konfiguration austauschbar |
| **E3** | Kommerziell? | **Nicht kommerziell** | Open-Meteo Free ist nutzbar (CC BY 4.0, Attribution). Bei späterer Kommerzialisierung muss Wetter neu bewertet werden. |
| **E4** | Hosting | **GitHub Pages**; Gewässerdaten als GitHub-Release, beim Bauen eingebunden (Entscheidung M4, ARCHITECTURE §6.1a). Cloudflare R2 nur noch Option (Offline-Regionen M10) | Pages-Grenzen beobachten [O] |
| **E5** | App-Name | **„Fangpunkt"** (Arbeitsname) | Markenrecherche (DPMA) vor öffentlichem Start [O] |
| **E6** | Tiefenkarten | **Kein Tiefen-Feature im MVP**; Schnittstelle vorbereiten; Anfragen an Garmin, LM M-V, Anglerverband HH parallel | M9 erst nach schriftlicher Lizenzklärung |
| **E7** | Erstes Land für Rechtsinhalte | **NRW** | M7 erfasst NRW vollständig (neu geprüft am amtlichen Text). Weitere Länder in M8. Hamburg ist nicht mehr vorgezogen. |
| **E8** | Konten/Cloud-Sync | **Später** | Datenmodell bleibt sync-fähig (UUID, `updatedAt`, `deletedAt`, `rev`) |
| **E9** | Import von Backups der Alt-App | **Ja**, in M2 | Mapping laut DATA_MODEL §8; Test BAK-7 ist Pflicht |

---

## 7. Risiken (Kurzfassung, Details in DATA_SOURCES §8)

| # | Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|---|
| R1 | Datenverlust durch Browser-Löschung (iOS löscht Speicher von nicht installierten Websites nach 7 Tagen ohne Nutzung [A, verbreitet dokumentiert; O: aktuellen WebKit-Stand prüfen]) | hoch | Installation empfehlen, `persist()`, Backup-Erinnerung, Export |
| R2 | OpenFreeMap fällt aus oder ändert die Bedingungen | mittel | Anbieter konfigurierbar; Fallback-Style; M10 Self-Hosting |
| R3 | Größe der Gewässerdaten Deutschland: **157 MB PMTiles** (S1b), Metadaten stecken in den Kacheln | mittel | Range-Requests (Pages liefert 206); bei Problemen Aufteilung je Bundesland oder R2 |
| R4 | Tiefen-/Zonendaten ohne Nutzungsrecht | hoch (rechtlich) | Nur mit schriftlicher Erlaubnis; Altdaten HH nicht übernehmen |
| R5 | Rechtsangaben veraltet oder falsch | hoch | Prüfdatum, Veraltungswarnung, Hinweis „keine Rechtsauskunft", Quelle direkt verlinkt |
| R6 | iOS-PWA-Einschränkungen (kein Hintergrund-GPS, Push nur installiert ab 16.4) | mittel | Keine Funktion darauf aufbauen |
| R7 | Lizenzpflichten ODbL (Share-Alike für abgeleitete Datenbanken) | mittel | Gewässerdatenpaket unter ODbL veröffentlichen; Nutzerdaten bleiben privat und sind davon nicht betroffen [A, O: Rechtsprüfung bei Veröffentlichung] |

---

## 8. Empfohlener nächster Schritt

1. ~~Entscheidungen E1–E9~~ erledigt.
2. ~~M0~~ erledigt (Ergebnisse DATA_SOURCES §10).
3. ~~M1~~ erledigt.
4. ~~M2~~ erledigt.
5. ~~M3~~ erledigt.
6. ~~M4~~ erledigt.
7. **M5** (Fangbuch und Sessions), nach deiner Freigabe.

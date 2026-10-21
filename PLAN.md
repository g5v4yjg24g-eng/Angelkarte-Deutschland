# PLAN – Angel-App Deutschland (Neustart als PWA)

Stand: 2026-10-21 · Status: **M0 abgeschlossen** · nächster Schritt M1 nach Freigabe

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

### M0 – Entscheidungen und Spikes (vor Code) — ✅ erledigt 2026-10-21 (außer S1b/S2b)
- ✅ Entscheidungen E1–E9 (§6).
- ✅ **Spike S1:** Gewässer-Pipeline mit **NRW** (Geofabrik/Bremen war in der Umgebung gesperrt). Ergebnis: 163 294 Gewässer, 20,9 MB PMTiles, Hochrechnung DE 85–220 MB. Details DATA_SOURCES §10.1.
- ✅ **Spike S2:** OpenFreeMap + MapLibre + eigenes Overlay headless gemessen. Details DATA_SOURCES §10.2.
- ☐ **S1b:** voller Deutschland-Lauf (vor M4; braucht Geofabrik-Freigabe).
- ☐ **S2b:** Test auf deinen Geräten (Checkliste `tools/map-spike/README.md`; sinnvoll, sobald M1 eine Vorschau-URL hat).
- *Abnahme:* Entscheidungen in PLAN.md dokumentiert; Messwerte S1 und S2 in DATA_SOURCES.md eingetragen.

### M1 – Projektgerüst, Designsystem, PWA-Hülle
Abhängig von: M0
- Vite + React + TypeScript (strict), ESLint, Prettier, Vitest, Playwright, CI (GitHub Actions).
- Design-Tokens (Farben, Typo, Abstände, Radien, Schatten) hell und dunkel; Basiskomponenten (Button, IconButton, Sheet, Dialog, Field, Toast, EmptyState, Badge).
- Fisch-Logo als SVG-Master, daraus Icons (192, 512, maskable, Apple-Touch, Favicon).
- Intro-Animation (Kaltstart, ≤ 1,2 s, abbrechbar, Reduced-Motion-Variante).
- App-Shell mit Navigation: Karte · Fangbuch · Statistik · Mehr (Recht, Daten & Backup, Einstellungen, Info/Quellen).
- vite-plugin-pwa: Precache, Update-Hinweis („Neue Version – neu laden").
- *Abnahme:* Lighthouse PWA installierbar; Lighthouse Performance ≥ 90 (mobil, Shell); Intro erscheint bei Kaltstart und nicht nach Tab-Wechsel; Reduced Motion zeigt statisches Logo ≤ 300 ms.

### M2 – Lokale Datenhaltung
Abhängig von: M1
- Dexie-Schema v1 (DATA_MODEL.md), Repositories pro Entität, Zod-Schemas, Migrationsgerüst.
- `navigator.storage.persist()` mit erklärendem Hinweis; Speicherplatzanzeige.
- Export (JSON, optional mit Fotos als ZIP), Import mit Validierung, Vorschau und Konfliktstrategie.
- Importer für Backups der Alt-App (`{app:'angelkarte', version:2}`, E9), inkl. Fotos aus DataURLs → Photo-Blobs.
- Backup-Erinnerung.
- *Abnahme:* Roundtrip-Test (Export → Löschen → Import → identisch); kaputte und manipulierte Dateien werden abgelehnt, ohne Daten zu verändern; Migrationstest v1 → v2 (Dummy).

### M3 – Deutschlandkarte
Abhängig von: M1
- MapLibre GL JS mit Basiskarte (E2), Attribution, Zoom, Kompass, Standort (Freigabe nur auf Knopfdruck, Fehlerzustände).
- Tipp auf die Karte öffnet ein Bottom Sheet mit „Angelstelle / Steg / Fang / Kontakt / Sonstiges".
- Darstellung eigener Markierungen (Symbolsystem, Clustering).
- *Abnahme:* 60 fps beim Verschieben auf einem Mittelklasse-Android [A]; Standort wird nie ohne Nutzeraktion angefragt; Offline zeigt die Karte einen klaren Hinweis statt grauer Fläche.

### M4 – Gewässerbasis (Stufe 1) und Gewässerprofil
Abhängig von: M3, Spike S1
- Datenpipeline `tools/water-pipeline` (OSM-PBF → gefilterte Gewässer → PMTiles + Suchindex + Gewässer-Metadaten), reproduzierbar per Skript, mit Versionsnummer und Datenstand.
- Gewässer-Layer antippbar → Profil (Name, Typ, Fläche, Lage/Gemeinde/Land, Quelle OSM + Stand, Tiefenkartenstatus „nicht verfügbar", Rechtsstatus des Landes, eigene Stellen/Fänge).
- Suche: Gewässer und Orte aus eigenem Index (kein Nominatim-Autocomplete).
- *Abnahme:* Stichprobe von 20 bekannten Gewässern (Liste in TEST_PLAN) auffindbar und korrekt verortet; Profil zeigt fehlende Angaben als „unbekannt"; der Datenstand ist sichtbar.

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
| **E4** | Hosting | **GitHub Pages für M1–M3, Cloudflare Pages + R2 ab M4** | [O] R2-Konditionen vor M4 prüfen |
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
| R3 | Größe der Gewässerdaten Deutschland: hochgerechnet 85–220 MB PMTiles, 22–58 MB Metadaten (S1) | mittel | Metadaten nach Kachel teilen; Hosting mit Range-Requests (R2); S1b bestätigt die Zahlen |
| R4 | Tiefen-/Zonendaten ohne Nutzungsrecht | hoch (rechtlich) | Nur mit schriftlicher Erlaubnis; Altdaten HH nicht übernehmen |
| R5 | Rechtsangaben veraltet oder falsch | hoch | Prüfdatum, Veraltungswarnung, Hinweis „keine Rechtsauskunft", Quelle direkt verlinkt |
| R6 | iOS-PWA-Einschränkungen (kein Hintergrund-GPS, Push nur installiert ab 16.4) | mittel | Keine Funktion darauf aufbauen |
| R7 | Lizenzpflichten ODbL (Share-Alike für abgeleitete Datenbanken) | mittel | Gewässerdatenpaket unter ODbL veröffentlichen; Nutzerdaten bleiben privat und sind davon nicht betroffen [A, O: Rechtsprüfung bei Veröffentlichung] |

---

## 8. Empfohlener nächster Schritt

1. ~~Entscheidungen E1–E9~~ erledigt.
2. ~~M0~~ erledigt (Ergebnisse DATA_SOURCES §10); offen: S1b, S2b.
3. **M1** (Projektgerüst, Designsystem, Logo, Intro, PWA-Hülle), nach deiner Freigabe.

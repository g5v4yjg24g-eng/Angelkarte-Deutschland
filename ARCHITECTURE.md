# ARCHITECTURE – Angel-App Deutschland

Stand: 2026-10-21 · Entwurf · Kennzeichnung: **[V]** verifiziert · **[A]** Annahme · **[O]** offen

## 1. Leitprinzipien

1. **Local-first:** Persönliche Daten entstehen und liegen auf dem Gerät. Netzwerk ist optional.
2. **Statisch vor dynamisch:** Gewässer-, Rechts- und Kartendaten werden **vorab** erzeugt und als versionierte statische Dateien ausgeliefert. Zur Laufzeit gibt es keine Massenabfragen an öffentliche Geodienste.
3. **Austauschbare Anbieter:** Basiskarte, Tiefenkarten, Wetter, Suche und Fischbestimmung liegen hinter Schnittstellen (`ports`).
4. **Ehrliche Daten:** Jede Fremdangabe trägt Quelle, Stand und Vertrauensstufe. Was fehlt, wird als „unbekannt" angezeigt.
5. **Kleine Abhängigkeitsliste:** Eine Bibliothek kommt nur dazu, wenn sie deutlich Arbeit oder Fehler spart.

## 2. Tech-Stack und Begründung

| Schicht | Wahl | Begründung | Verworfen |
|---|---|---|---|
| Sprache | **TypeScript 6.0 (strict)** | Gefordert; fängt Modellfehler früh. TS 7 erst, wenn typescript-eslint es unterstützt (Stand 2026-10: < 6.1) | – |
| Build | **Vite** | Schnell, Standard für SPAs, sehr gutes PWA-Plugin | Webpack (langsamer, mehr Konfiguration) |
| UI | **React 19** | Größtes Ökosystem, gut dokumentiert, viele Entwickler finden sich zurecht; `react-map-gl` bzw. direkte MapLibre-Anbindung erprobt | SvelteKit (kleiner, aber weniger Bibliotheken und SSR-Fokus unnötig); Vanilla (Altprojekt zeigt Wartungsgrenzen) |
| Routing | **React Router (Library-Modus)** | Einfach, URL-fähig (Deep-Links auf Gewässer und Fang) | TanStack Router (mächtiger als nötig) |
| Zustand | **Dexie `liveQuery`** für persistente Daten + **Zustand** (Lib) für UI-Zustand | Die DB ist die Wahrheit; kein doppelter Store | Redux (zu schwer) |
| Lokale DB | **IndexedDB über Dexie 4** | Ausgereift, Migrationen, Indizes, Blob-Speicherung, gute TS-Typen | OPFS + SQLite-WASM (stärker, aber größer und komplexer; erst bei Sync-Bedarf neu bewerten); localStorage (ungeeignet) |
| ZIP | **fflate** (MIT) | Sicherungen mit Fotos als ZIP; klein, ohne Abhängigkeiten; pmtiles nutzt es ab M3 ohnehin | JSZip (größer) |
| Validierung | **Zod** | Ein Schema für Formulare, Import, Rechtsdaten und Migrationen | Eigene Prüfungen (fehleranfällig) |
| Karte | **MapLibre GL JS** | Open Source (BSD-3) [A: Lizenz bei Installation prüfen], Vektorkacheln, WebGL-Performance für ganz Deutschland, PMTiles-Protokoll | Leaflet (Raster; Vektorlayer für Tausende Polygone zu langsam) |
| Kachelformat | **PMTiles** | Eine Datei auf Objektspeicher, Abruf per HTTP-Range, keine Kachelserver-Software [V: docs.protomaps.com] | Kachelserver (Betriebsaufwand) |
| Diagramme | **Eigene SVG-Komponenten** + `d3-scale`/`d3-shape` | Wenige Diagrammtypen (Balken, Linie, Donut-frei), volle Designkontrolle, klein | Chart.js/Recharts (größer, Standard-Look) |
| PWA | **vite-plugin-pwa (Workbox)** | Precache-Manifest, Update-Flow, Runtime-Caching-Regeln deklarativ | Eigener SW (Altprojekt zeigt Fehleranfälligkeit) |
| Styling | **CSS Modules + CSS Custom Properties (Tokens)** | Keine Laufzeitkosten, Theme-Wechsel über Variablen | Tailwind (möglich; Tokens-Ansatz ist für ein eigenes Designsystem klarer) |
| Tests | **Vitest**, **Testing Library**, **Playwright Test**, **axe-core** | Siehe TEST_PLAN | – |
| Datenpipeline | **Node/TS-Skripte + osmium-tool + tippecanoe** (CLI) | Bewährte Werkzeuge für OSM → Vektorkacheln; reproduzierbar in CI | Overpass zur Laufzeit (Richtlinien, Last) |

Versionen werden beim Projektsetup **exakt gepinnt** (Lockfile) und nicht aus dem Gedächtnis übernommen.

## 3. Systemübersicht

```
┌────────────────────────── Gerät (Browser / installierte PWA) ──────────────────────────┐
│  UI (React)  ──►  Features  ──►  Domain (reine TS-Logik)  ──►  Repositories (Dexie)     │
│                     │                                            IndexedDB: Fänge,      │
│                     │                                            Stellen, Sessions, Fotos│
│                     ▼                                                                    │
│                 Ports/Adapter: BasemapProvider · WaterIndex · DepthProvider ·           │
│                                WeatherProvider · RegulationStore · SpeciesIdProvider    │
│  Service Worker: App-Shell-Precache · Datenpakete (stale-while-revalidate) · Kartencache │
└──────────────────────────────────────────────┬─────────────────────────────────────────┘
                                               │ HTTPS (nur statische Dateien + 1 Wetter-API)
       ┌───────────────────────────────────────┼───────────────────────────────────────┐
       ▼                                       ▼                                       ▼
 Statisches Hosting (App)        Objektspeicher (PMTiles, Indizes)          Externe Dienste
 index.html, JS, CSS, Icons      water-de-<ver>.pmtiles                     Basiskarte (E2)
                                 search-de-<ver>/*.json                     Wetter (E3)
                                 regulations/<land>.json
                                               ▲
                                               │ erzeugt durch
                          tools/ (lokal oder CI): OSM-PBF → osmium → tippecanoe → PMTiles
                                                  Monitoring-CSV → Arten je Gewässer (P2)
                                                  Rechts-JSON → Schema-Check
```

## 4. Projektstruktur (Ziel)

```
/
├─ app/                        # PWA (Vite-Projekt)
│  ├─ public/                  # Icons, Manifest-Assets, Fonts
│  ├─ src/
│  │  ├─ app/                  # Shell, Router, Provider, Intro, Update-Hinweis
│  │  ├─ design/               # Tokens, Basis-Komponenten, Icons (SVG-Sprite)
│  │  ├─ features/
│  │  │  ├─ map/               # Karte, Layer, Tipp-Aktion, Standort
│  │  │  ├─ waters/            # Gewässerprofil, Suche
│  │  │  ├─ markers/           # Angelstellen, Stege
│  │  │  ├─ catches/           # Fangbuch, Formular, Fotos
│  │  │  ├─ sessions/
│  │  │  ├─ stats/
│  │  │  ├─ regulations/
│  │  │  ├─ depth/
│  │  │  ├─ backup/            # Export, Import, Erinnerung
│  │  │  └─ settings/
│  │  ├─ domain/               # Typen, Zod-Schemas, reine Funktionen (Statistik, Schonzeit-Prüfung)
│  │  ├─ data/                 # Dexie-DB, Migrationen, Repositories
│  │  ├─ ports/                # Schnittstellen externer Anbieter
│  │  ├─ adapters/             # Implementierungen (openfreemap, pmtiles, open-meteo, …)
│  │  └─ lib/                  # Hilfen (Zeit/Zeitzone, Geo, Formatierung)
│  └─ tests/e2e/
├─ data/
│  ├─ regulations/             # <land>.json – redaktionell gepflegt, im Repo versioniert
│  └─ species/                 # Artenliste (Namen, wiss. Namen)
├─ tools/
│  ├─ water-pipeline/          # OSM → PMTiles + Suchindex
│  └─ validate-data/           # Schema-Checks für data/
└─ PLAN.md, ARCHITECTURE.md, … # Planungsdokumente im Repo-Root (siehe CLAUDE.md)
```

Abhängigkeitsregel: `features → domain/data/ports`; `domain` importiert **nichts** aus UI, Dexie oder Adaptern. Das wird per ESLint-Regel (`import/no-restricted-paths`) erzwungen.

## 5. Karte

### 5.1 Ebenen (von unten nach oben)
1. **Basiskarte** (Vektor, E2), heller und dunkler Style.
2. **Gewässer-Overlay** aus eigener PMTiles-Datei: Flächen (Seen, Teiche, Talsperren, breite Flüsse) und Linien (Flüsse, Kanäle). Hervorhebung beim Hover/Tipp. Die Eigenschaft `wid` (Water-ID) verbindet Overlay und Profil.
3. **Tiefen-Overlay** (nur im Tiefenmodus, P2).
4. **Eigene Markierungen** (GeoJSON-Quelle aus Dexie, geclustert).
5. **Standort** (Punkt + Genauigkeitskreis).

### 5.1a Umsetzung (M3)
- `app/src/features/map/MapView.tsx` (lazy), Ebenen in `mapLayers.ts`, Symbole in `markerIcons.ts` (SVG → Raster 72 px, Pixelverhältnis 2).
- Eigene Ebenen werden nach jedem Stilwechsel (`style.load`) neu eingehängt; Daten kommen live aus Dexie.
- Basiskarten-Beschriftung wird beim Laden auf `name:de` → `name` umgestellt (`germanLabels.ts`).
- Ersatzstil `fangpunkt-offline` (nur Hintergrund) bei fehlendem Netz oder Stilfehler.
- Testzugriff: `window.__fangpunktMap` (für E2E; enthält keine Nutzerdaten über die Karte hinaus).

### 5.2 Tipp-Ablauf
```
Tipp auf Karte
 ├─ trifft eigene Markierung → Mini-Karte der Markierung (Bearbeiten, Löschen, Navigieren)
 ├─ trifft Gewässer          → Bottom Sheet "Gewässer X"  [Profil öffnen] [+ Hier markieren]
 └─ leere Fläche             → Bottom Sheet "Neu an dieser Stelle":
                                Angelstelle · Angelsteg · Fang · Kontakt/Fehlbiss · Sonstiges
```
Ein langer Druck öffnet direkt „Neu an dieser Stelle" (auch über Gewässerflächen). So gibt es keinen eigenen Menüpunkt für Markierungen.

### 5.3 Symbolsystem
- Persönliche Orte: **Form = Typ** (Angelstelle: Tropfen-Pin; Steg: Quadrat mit Steg-Glyph; Sonstiges: Raute).
- Fangereignisse: **Kreis**, Farbe = Ergebnis (Fang, Kontakt, Fehlbiss), immer zusätzlich ein Glyph. Farbe ist nie die einzige Unterscheidung (Barrierefreiheit).
- Gewässer: Farbe nach Datenstufe ist **nicht** geplant. Stattdessen zeigt das Profil die Stufe als Badge, damit die Karte ruhig bleibt.

### 5.4 Standort
- Standort startet standardmäßig beim Öffnen der Karte (Entscheidung 2026-10-22, Einstellung „Standort: Beim Kartenstart“); der Browser fragt einmal um Erlaubnis. Ist der Zugriff verweigert, bleibt es beim Start still. Mit „Nur auf Knopfdruck“ erst nach Tipp auf den Button, beim ersten Mal mit Erklärtext.
- `watchPosition` nur, solange die Karte sichtbar ist. Bei `visibilitychange` wird gestoppt.
- Kein Hintergrund-Tracking. In Browsern ist das ohne aktive Seite nicht zuverlässig möglich [A, plattformbekannt]. Der Auftrag fordert es auch nicht.
- **Routenaufzeichnung in Sessions** (Session-Rückblick, Wunsch Nutzer 2026-10-23): ein einziger `watchPosition`-Zuhörer (`features/sessions/tracking/SessionTracker.tsx`), nur solange eine Session läuft, nicht pausiert ist, die Einstellung „Route bei Sessions“ an ist und die App sichtbar ist. Hohe Genauigkeit (nötig für eine Route am Ufer); gespeichert wird höchstens alle 10 s und erst ab 8 m Bewegung, ungenaue Fixe (> 50 m) und Sprünge (> 15 m/s) werden verworfen, nach Neustart/Lücke > 5 min beginnt ein neuer Abschnitt (`domain/track.ts`). Jeder Punkt wird sofort in IndexedDB geschrieben (`data/trackService.ts`).
- **Grenze der PWA:** Im Hintergrund (andere App, Bildschirm aus) liefern Browser keinen Standort – iOS gar nicht, Android/Chrome nicht verlässlich [A, plattformbekannt; nicht auf echten Geräten geprüft – O]. Die App behauptet dann nichts: Status „App im Hintergrund“, im Rückblick eine nicht verbundene Lücke. Eine echte Hintergrund-Aufzeichnung bräuchte eine native Hülle (z. B. Capacitor mit einem Hintergrund-Standort-Plugin) – offen, nicht entschieden [O].

## 6. Gewässerdaten-Architektur

### 6.1 Pipeline (`tools/water-pipeline`)
1. Download Geofabrik `germany-latest.osm.pbf` (~4,5 GB, täglich aktualisiert) [V] oder Länderauszüge; Umsetzung und Abweichungen in §6.1a.
2. `osmium tags-filter`: `natural=water`, `water=*`, `waterway=river|canal|stream`(nur benannte), `landuse=reservoir|basin`, `leisure=fishing`; Relationen mit Multipolygon auflösen.
3. Normalisieren → `WaterBody`-Datensätze (DATA_MODEL §3): `wid`, Name, Typ, Fläche, Bounding Box, Repräsentativpunkt, Land/Kreis/Gemeinde (Spatial Join mit Verwaltungsgrenzen aus OSM `admin_level` 4/6/8), OSM-Tags-Auszug.
4. Ausgaben:
   - `water-de-<YYYYMMDD>.pmtiles` (Geometrien, Zoom 6–14, generalisiert)
   - `search-de-<YYYYMMDD>/` (Suchindex, nach Präfix geteilt, je ≤ 200 KB [A])
   - `waters-de-<YYYYMMDD>/<shard>.json` (Profil-Metadaten, nach Kachel oder ID-Hash geteilt)
   - `manifest.json` (Version, Datenstand, Lizenz, Prüfsummen)
5. Qualitätsbericht: Anzahl je Typ und Land, unbenannte Gewässer, Größenstatistik.

**Datenstand-Rhythmus:** monatlich [A], manuell ausgelöst in CI. Die App lädt das neue Manifest im Hintergrund und wechselt beim nächsten Start.

### 6.1a Umsetzung (M4)
- **Profilfelder stecken in den Kacheln** (`wid`, `t`, `n`, `mz`, `ha`, `s`, `k`, `g`); eine separate Metadaten-Datei entfällt. Das Gewässerprofil liest die Eigenschaften des angetippten Objekts. Nachteil: Fließgewässer zeigen nur den angetippten Abschnitt (Hinweis im Profil); ein „ganzer Fluss" braucht später die `type=waterway`-Relationen.
- Pipeline in zwei Durchläufen (erst Verwaltungsgrenzen und Orte, dann Gewässer streamen), damit der Deutschland-Auszug nicht im Speicher liegt.
- `water-manifest.json` (Format, Datenstand aus dem PBF-Kopf, Lizenz, Abdeckung nach Bundesland) – die App zeigt Datenstand und Abdeckung an.
- App-Seite: Port `WaterDataProvider` (`app/src/ports/waterData.ts`), Adapter `staticWaterData(baseUrl)`; Basis-URL über `VITE_WATER_BASE_URL` austauschbar.
- Gewässerebenen sind unsichtbar (die Basiskarte zeichnet das Wasser) und dienen dem Antippen; das gewählte Gewässer wird über `feature-state` hervorgehoben.
- **Datenlauf in CI:** `.github/workflows/wasserdaten.yml` (manuell oder per Push auf `datenlauf/*`): Auszug von Geofabrik (Ersatz openstreetmap.fr, MD5), tippecanoe 2.79.0 aus dem Quellcode, `run.sh`, Stichprobe WAT-2, Release `wasserdaten-<datenstand>-<lauf>`, danach Neubau der Vorschau.
- **Prüfung:** Schritt 5 (`src/verify.ts`) vergleicht jedes Objekt der z14-Kacheln mit der Eingabe (vorhanden, Eigenschaften gleich). Der Lauf bricht sonst ab. Grund: tippecanoe 2.49 verlor Objekte und vertauschte IDs (DATA_SOURCES §10.4).
- **Grenzgewässer:** Schritt 1b lädt unvollständige Gewässer-Relationen mit einer Overpass-Abfrage nach (nur beim Bauen) und fügt sie per `osmium apply-changes` ein; das Manifest vermerkt das in `source.supplement`.
- **Hosting (Entscheidung M4, ersetzt E4 vorerst):** Datenpaket `wasserdaten.tar.gz` als Anhang eines GitHub-Releases `wasserdaten-<datum>`; der Pages-Workflow lädt es beim Bauen und liefert es mit der App aus. GitHub Pages beantwortet Range-Anfragen (HTTP 206) und sendet `Access-Control-Allow-Origin: *` [V 2026-10-21]. Kein zusätzliches Konto, keine Kosten. Cloudflare R2 bleibt Option für Offline-Regionen (M10) oder falls Pages-Grenzen erreicht werden.

### 6.2 Stabile IDs
`wid = "osm:" + type[0] + id` (z. B. `osm:w35044256`). OSM-IDs können sich bei Bearbeitungen ändern (z. B. Way → Multipolygon). Deshalb speichert jede Nutzerreferenz zusätzlich `waterSnapshot {name, centroid}`. Wird eine `wid` nach einem Datenupdate nicht mehr gefunden, sucht die App per Name und Nähe einen Nachfolger und fragt die Nutzerin oder den Nutzer, bevor sie neu zuordnet.

### 6.3 Suche
- Clientseitig: Präfix-Shard laden → Fuzzy-Matching (normalisiert: Umlaute, „See"/„Teich" als Suffix-Token) → Ranking nach Fläche und Nähe zur Kartenmitte.
- Orte (Städte, Gemeinden, Ortsteile) stammen aus derselben Pipeline (`place=*`). Damit gibt es **keinen** Laufzeit-Geocoder und kein Nominatim-Autocomplete (dort ausdrücklich verboten [V]).

## 7. Offline- und Cache-Strategie

| Ressource | Strategie | Offline verfügbar? |
|---|---|---|
| App-Shell (HTML, JS, CSS, Icons, Fonts) | Precache (Workbox, revisioniert) | **Ja** |
| Persönliche Daten | IndexedDB | **Ja** |
| Fotos | IndexedDB (Blob, komprimiert ≤ 1600 px, JPEG/WebP q≈0,8 [A]) | **Ja** |
| Rechtsdaten | Precache (klein) + Versionsprüfung | **Ja**, mit Stand-Anzeige |
| Gewässer-Metadaten & Suche | Runtime-Cache, stale-while-revalidate, LRU-Grenze | **Teilweise** (bereits besuchte Bereiche) |
| Basiskarte | Runtime-Cache nur besuchter Kacheln, Header respektieren | **Nicht zugesagt** bis M10 |
| Gewässer-PMTiles | Range-Antworten im Cache [O: Range-Caching im SW testen] | **Nicht zugesagt** bis M10 |
| Wetter | Nur online; fehlende Werte werden beim nächsten Online-Start nachgeladen | Nein (klar gekennzeichnet) |
| Tiefenkarten | Abhängig vom Anbieter | **Nein**, bis implementiert und getestet |

Online-Status: Ein Indikator in der Kopfzeile erscheint nur offline. Online-pflichtige Aktionen werden deaktiviert und erklärt, nicht versteckt.

### 7.1 Updates
- `registerType: 'prompt'`: Eine neue Version wird im Hintergrund geladen, dann erscheint „Update verfügbar – Neu laden". Kein erzwungener Reload während eines offenen Formulars.
- Datenbankmigrationen laufen beim Start **vor** dem Rendern. Vorher wird automatisch ein interner Snapshot der betroffenen Tabellen angelegt (letzte 2 behalten).

## 8. Intro und Branding

- Logo: ein stilisierter Fisch (Seitenansicht, 2–3 Flächen, geometrisch) als **ein SVG-Master** (`design/brand/fish.svg`). Daraus werden per Build-Skript alle PNG-Icons (inkl. `maskable` mit Safe Zone 80 %) und das Apple-Touch-Icon erzeugt.
- Intro: Inline-SVG + CSS-Animation **direkt in `index.html`**, damit es vor dem JS-Bundle sichtbar ist. Der Fisch schwimmt ein, der Schwanz schlägt einmal, dann blendet es zur App über.
  - Dauer: Mindestens 750 ms Animation, danach 250 ms Ausblenden, sobald die App bereit ist (umgesetzt in M1). Ist die App langsamer, bleibt das Intro als Ladebildschirm stehen, höchstens 8 s.
  - Tipp überspringt das Intro.
  - `prefers-reduced-motion: reduce` → statisches Logo, 200 ms, Überblendung 150 ms.
  - Theme-Wahl liegt bewusst in `localStorage` (`fangpunkt.theme`): Sie muss vor dem ersten Zeichnen synchron lesbar sein. Alle übrigen Einstellungen kommen ab M2 in die Datenbank.
  - Kaltstart-Erkennung: Das Intro läuft nur beim Laden des Dokuments. Eine Rückkehr aus dem Hintergrund lädt das Dokument nicht neu, deshalb ist kein Zusatzcode nötig. Bei `pageshow` mit `persisted=true` (bfcache) wird es nicht erneut gezeigt.
- Designsystem: Tokens in `design/tokens.css`. Vorschlag „Tiefwasser" (wird in M1 visuell abgestimmt):
  - Primär Petrol `#0F5C6E`, Akzent Signalorange `#F2994A` (für Fang-Hervorhebungen), Neutraltöne mit leichtem Blaustich, Fehler `#C2410C`, Erfolg `#15803D`.
  - Typografie: **Inter** (UI) und optional **Fraunces** für Überschriften; selbst gehostet, Subset `latin-ext` (Umlaute). Ziffern mit `tabular-nums` in Statistiken.
  - Kontrast WCAG AA in hell und dunkel, geprüft per Skript.

## 9. Konten und Cloud-Sync – Bewertung

**Nicht für 1.0.** Begründung:
- Kein Auftragsziel erfordert geräteübergreifende Daten. Export/Import deckt Gerätewechsel ab.
- Sync bedeutet Backend, Authentifizierung, Konfliktlösung, DSGVO-Verarbeitungsverzeichnis, AV-Verträge, Kosten.
- Vorbereitung jetzt (kostet wenig): UUIDs, `createdAt`/`updatedAt`, `deletedAt` (Soft-Delete) und `rev`-Zähler in allen Nutzerentitäten. Damit ist ein späterer Sync (z. B. CRDT-frei mit Last-Writer-Wins pro Feld) möglich, ohne Migration der IDs.

**Entscheidung Nutzer 2026-10-25 – Konten (Etappe 1 umgesetzt):** Ziel ist ein späteres kommerzielles Angebot; vorerst kostenlos, mit **freiwilligem** Konto als Grundlage für Freunde.
- Backend: Supabase-Projekt „Fangpunkt“ (Region eu-west-1/Irland). Schema im Repo unter `supabase/migrations/` (Etappe 1: `profiles` mit RLS – jeder liest/ändert nur sein Profil, Nutzername fest; Funktionen `username_available`, `delete_my_account`). Nur der öffentliche Schlüssel (`sb_publishable_…`) steht in der App; der geheime Schlüssel nie.
- Anmeldung per E-Mail-Code (OTP), nicht per Link (Links öffnen auf iOS Safari statt der installierten PWA). E-Mail-Vorlage „Magic Link“ muss `{{ .Token }}` enthalten. Der eingebaute Mailversand von Supabase stellt nur an Team-Mitglieder zu [V: supabase.com/docs/guides/auth/auth-smtp, 2026-10-25], und Vorlagen lassen sich erst mit eigenem SMTP bearbeiten (Dashboard-Hinweis, vom Nutzer gesehen 2026-10-25) – für echte Nutzer eigener SMTP-Anbieter nötig **[O]** (Empfehlung Brevo, EU; eigene Domain). **Übergangslösung (Entscheidung Nutzer 2026-10-25):** Bis dahin funktioniert auch der Link aus der Standard-Mail: impliziter Ablauf (`flowType: 'implicit'`, `detectSessionInUrl`), Ziel = Startseite (Site URL), `features/account/AuthRedirect.tsx` leitet mit dem #-Teil zur Kontoseite. Auf dem iPhone öffnet der Link Safari statt der Homescreen-App.
- App: Port `ports/account.ts`, Adapter `adapters/supabaseAccount.ts` (supabase-js, nur bei Bedarf geladen; Sitzung in localStorage `fangpunkt.auth`), Regeln `domain/account.ts`, Ansicht `features/account` (Mehr → Konto). Ohne Anmeldung kein Kontakt zu Supabase.
- Fangbuch, Fotos, Orte und Routen bleiben lokal. Etappe 2: Freunde (Suche nach Nutzername, Anfragen). Etappe 3: gezieltes Teilen, optional Cloud-Sicherung.

## 10. Erweiterungspunkt Fischbestimmung (P3)

```ts
interface SpeciesIdProvider {
  readonly id: string;               // "none" | "onnx-local" | "remote-xyz"
  isAvailable(): Promise<boolean>;
  identify(photo: Blob, hints?: { waterId?: string; date?: string }):
    Promise<SpeciesIdResult>;
}
interface SpeciesIdResult {
  candidates: { speciesId: string; confidence: number }[]; // absteigend
  lengthEstimateCm?: { low: number; high: number; method: 'reference-object' | 'model' };
  weightEstimateG?: { low: number; high: number; basis: 'length-weight-formula' };
  modelVersion: string;
}
```
- Ergebnis wird nur als **Vorschlag** ins Formular übernommen (Feld `speciesSource: 'ai-suggestion'`). Die Nutzerin oder der Nutzer bestätigt es.
- Fotos bleiben unverändert in der DB, sodass später auch bestehende Fänge analysiert werden können.
- Gewicht nur als Spanne aus Länge über artspezifische Längen-Gewichts-Formeln, mit Quelle.

## 11. Sicherheit und Datenschutz

- Keine Tracker und kein Analytics im MVP. Falls doch gewünscht: nur ein cookieloses, selbst gehostetes Werkzeug nach gesonderter Entscheidung.
- Content-Security-Policy: `default-src 'self'`, erlaubte Hosts explizit (Kartenanbieter, Wetter).
- Fremddaten (Import, Rechts-JSON, Gewässer-JSON) werden per Zod validiert und **nie** als HTML gerendert (kein `innerHTML`).
- Konto (freiwillig, seit 2026-10-25): Server speichert nur E-Mail (Supabase Auth), Nutzername und Anzeigename; Zugriff über RLS; Konto-Löschung in der App.
- Standort wird nicht übertragen. Ausnahme: gerundete Koordinaten (3 Nachkommastellen ≈ 100 m) an den Wetteranbieter, wenn Wetter aktiv ist (Standard: an, abschaltbar). Das steht in der Datenschutzerklärung.
- EXIF-Daten (GPS) aus Fotos werden beim Speichern entfernt (Re-Encoding über Canvas), die Position steht ja im Fang.

## 12. Fehlerbehandlung

- Zentrale `AppError`-Typen (`StorageError`, `QuotaError`, `NetworkError`, `ValidationError`, `PermissionError`) mit nutzerfreundlicher Meldung und Handlungsoption.
- Schreibvorgänge laufen transaktional (Dexie-Transaktionen). Ein Formular schließt erst nach erfolgreichem Commit. Fehler halten die Eingaben im Formular.
- Quota: Vor Foto-Speicherung `navigator.storage.estimate()` prüfen; bei < 50 MB frei warnen.
- React Error Boundary pro Feature-Bereich. Ein Fehler in der Statistik darf die Karte nicht mitreißen.

# DATA_MODEL – Datenmodelle und Beziehungen

Stand: 2026-10-21 · Entwurf. Typen als TypeScript-Notation; im Code entstehen sie aus **Zod-Schemas** (`domain/schemas`).

## 1. Grundregeln

- **IDs:** `string` (UUID v4 via `crypto.randomUUID()`) für Nutzerdaten; `wid` für Gewässer (`osm:w123`, `osm:r456`).
- **Zeit:** Zeitpunkte als ISO-8601 mit Offset (`2026-10-21T14:05:00+02:00`) **plus** `tz: "Europe/Berlin"`. Statistik nach Kalendertag in der gespeicherten Zeitzone. (Das Altprojekt löste Tagesgrenzen bereits über Europe/Berlin; das bleibt erhalten.)
- **Koordinaten:** `{ lat: number; lng: number }` WGS84, gespeichert mit 6 Nachkommastellen; `accuracyM?` bei GPS-Erfassung.
- **Unbekannt vs. leer:** Optionale Felder fehlen (`undefined`), wenn unbekannt. `null` wird nicht verwendet. Für Fremddaten gibt es den expliziten Typ `Known<T>` (§4).
- **Sync-Vorbereitung** (alle Nutzerentitäten):
  ```ts
  interface Meta { id: string; createdAt: string; updatedAt: string; deletedAt?: string; rev: number; }
  ```
  Löschen = `deletedAt` setzen (Papierkorb 30 Tage, danach endgültig). So ist „Rückgängig" möglich.

## 2. Entitäten-Übersicht

```
                 ┌──────────────┐
                 │  WaterBody   │  (statisch, aus Pipeline; nicht in Nutzer-DB)
                 └──────┬───────┘
          waterId (0..1)│
     ┌──────────────────┼──────────────────────┐
     ▼                  ▼                      ▼
┌──────────┐      ┌──────────┐  sessionId ┌──────────┐
│  Place   │◄─────│  Catch   │───────────►│ Session  │
│(Stelle,  │placeId│(Fang/    │   (0..1)   └──────────┘
│ Steg, …) │(0..1)│ Kontakt/ │
└──────────┘      │ Fehlbiss)│──photoIds──►┌──────────┐
                  └──────────┘   (0..n)    │  Photo   │
                        │                  └──────────┘
                        └─baitPresetId──►┌────────────┐
                                (0..1)   │ BaitPreset │
                                         └────────────┘
 RegulationSet (je Land, statisch) ◄── stateCode ── WaterBody
 WaterRuleSet  (je Gewässer, statisch, P3) ◄── waterId
 DepthCoverage (je Gewässer, statisch) ◄── waterId
```

## 3. Statische Daten (aus Pipeline / Redaktion)

```ts
type WaterType = 'lake' | 'pond' | 'reservoir' | 'river' | 'canal' | 'stream'
               | 'oxbow' | 'gravel_pit' | 'harbour' | 'other';

interface WaterBody {
  wid: string;                       // "osm:w35044256"
  name?: string;                     // fehlt bei unbenannten Gewässern
  altNames?: string[];
  type: WaterType;                   // aus OSM-Tags abgeleitet (Mapping-Tabelle im Pipeline-Code)
  areaHa?: number;                   // aus Geometrie berechnet (nur Flächen)
  lengthKm?: number;                 // nur Linien
  centroid: LatLng;                  // repräsentativer Punkt INNERHALB der Fläche
  bbox: [number, number, number, number];
  admin: { stateCode: StateCode; district?: string; municipality?: string };
  level: 1 | 2 | 3 | 4;              // Datenstufe (DATA_SOURCES §0)
  facts?: WaterFacts;                // Stufe 2+
  source: SourceRef;                 // OSM + Datenstand
}

type StateCode = 'BW'|'BY'|'BE'|'BB'|'HB'|'HH'|'HE'|'MV'|'NI'|'NW'|'RP'|'SL'|'SN'|'ST'|'SH'|'TH';

interface WaterFacts {
  maxDepthM?: Known<number>;
  meanDepthM?: Known<number>;
  speciesRecords?: SpeciesRecord[];   // Monitoring-Nachweise, nicht "Bestand"
}

interface SpeciesRecord {
  speciesId: string;                 // aus data/species
  lastRecordedYear: number;
  source: SourceRef;                 // z. B. GBIF-Datensatz
}

interface SourceRef {
  id: string;                        // "osm", "gbif:e0908eee…", "lm-mv-tiefen"
  label: string;                     // Anzeigename
  url?: string;
  license: string;                   // "ODbL-1.0", "CC-BY-4.0", …
  retrievedAt: string;               // Datenstand
}
```

## 4. Hilfstyp für Fremdangaben

```ts
type Known<T> =
  | { status: 'known'; value: T; source: SourceRef; measured: boolean }
  | { status: 'unknown' }
  | { status: 'not_applicable' };
```
`measured: false` kennzeichnet Schätzungen der Quelle. Die UI zeigt dann „ca." und den Hinweis „geschätzt laut Quelle".

## 5. Nutzerdaten (IndexedDB / Dexie)

### 5.1 Place – persönliche Markierung
```ts
type PlaceType = 'spot' | 'jetty' | 'parking' | 'access' | 'hazard' | 'other';
// spot = Angelstelle, jetty = Angelsteg; weitere optional (Parkplatz, Zugang, Gefahrenstelle)

interface Place extends Meta {
  type: PlaceType;
  name?: string;                     // max 80
  notes?: string;                    // max 2000
  position: LatLng & { accuracyM?: number; source: 'map-tap' | 'gps' | 'import' };
  waterId?: string;
  waterSnapshot?: { name?: string; centroid: LatLng };
  photoIds?: string[];
}
```
Indizes: `id, type, waterId, updatedAt, deletedAt`.

### 5.2 Catch – Fangbuch-Eintrag
```ts
type CatchOutcome = 'caught' | 'contact' | 'missed_bite' | 'observation';
// caught      = bestätigter Fang (Fisch gelandet)
// contact     = Fischkontakt: Fisch war gehakt/im Drill, aber nicht gelandet
// missed_bite = Fehlbiss: Biss erkannt, kein Haken
// observation = Fisch gesehen/Raubaktivität (optional, zählt NICHT in Fangstatistik)

type ContactDetail = 'lost_on_hook_set' | 'lost_in_fight' | 'lost_at_landing';

interface Catch extends Meta {
  outcome: CatchOutcome;
  contactDetail?: ContactDetail;     // nur bei 'contact'
  at: string;                        // Zeitpunkt (ISO mit Offset)
  tz: string;
  position?: LatLng & { accuracyM?: number; source: 'map-tap' | 'gps' | 'place' | 'import' };
  waterId?: string;
  waterSnapshot?: { name?: string; centroid: LatLng };
  placeId?: string;
  sessionId?: string;

  speciesId?: string;
  speciesCertainty?: 'certain' | 'likely' | 'guess';
  speciesSource?: 'user' | 'ai-suggestion';   // Vorbereitung Fischbestimmung

  lengthCm?: number;  lengthMethod?: 'measured' | 'estimated';
  weightG?: number;   weightMethod?: 'weighed' | 'estimated' | 'calculated';
  released?: 'released' | 'kept';

  bait?: { name?: string; type?: BaitType; color?: string; sizeCm?: number; weightG?: number; hookSize?: string };
  baitPresetId?: string;
  method?: MethodId;                 // Spinnfischen, Grundangeln, Posen, Fliege, Drop-Shot, Jiggen, Schleppen, …
  retrieve?: string;
  depthFishedM?: number;
  gear?: string;

  conditions?: Conditions;           // Nutzereingaben
  weather?: WeatherSnapshot;         // automatisch geholt (P1)
  notes?: string;                    // max 4000
  photoIds?: string[];
}

interface Conditions {
  waterTempC?: number; turbidity?: 'clear'|'slightly_turbid'|'turbid';
  airTempC?: number; windBft?: number; windDir?: Compass8; cloudPct?: 0|25|50|75|100;
}

interface WeatherSnapshot {
  provider: 'open-meteo' | 'bright-sky';
  fetchedAt: string;
  kind: 'model' | 'station';
  tempC?: number; pressureHpa?: number; pressureTrend3h?: number;
  windMs?: number; windDirDeg?: number; gustMs?: number; cloudPct?: number; precipMm?: number; code?: number;
  attribution: string;
}
```
Indizes: `id, at, outcome, speciesId, waterId, sessionId, placeId, method, updatedAt, deletedAt`.
Validierung: `lengthCm` 1–250, `weightG` 1–100 000, `depthFishedM` 0–300; bei `outcome !== 'caught'` sind Länge und Gewicht nur als „geschätzt" erlaubt.

### 5.3 Session – Angelsession
```ts
interface Session extends Meta {
  startAt: string; endAt?: string;   // endAt fehlt = läuft
  tz: string;
  waterId?: string; waterSnapshot?: {...};
  title?: string; notes?: string;
  pauses?: { from: string; to: string }[];   // P1: aktive Angelzeit
  defaults?: { method?: MethodId; baitPresetId?: string };
}
```
Regeln: höchstens eine laufende Session. Dauer > 24 h → Hinweis „Session vergessen zu beenden?" mit Korrekturdialog (statt sie still zu verwerfen wie im Altprojekt). Fänge außerhalb `[startAt, endAt]` werden beim Bearbeiten markiert.

### 5.4 Photo
```ts
interface Photo extends Meta {
  blob: Blob;                 // re-encodiert, ohne EXIF, max 1600 px
  thumb: Blob;                // 320 px
  mime: 'image/jpeg' | 'image/webp';
  width: number; height: number; bytes: number;
  ownerType: 'catch' | 'place'; ownerId: string;
}
```
Getrennt gespeichert. So bleiben Listen und Statistik schnell, und der Export ohne Fotos ist möglich.

### 5.5 BaitPreset (Köder-Favorit)
```ts
interface BaitPreset extends Meta { label: string; bait: Catch['bait']; method?: MethodId; }
```

### 5.6 Settings / AppMeta (Key-Value)
`theme`, `units`, `lastBackupAt`, `changesSinceBackup`, `backupReminderSnoozedUntil`, `dataPackVersion`, `persistGranted`, `introSeenVersion` (nur für „Was ist neu").

## 6. Tiefenkarten

```ts
interface DepthCoverage {
  waterId: string;
  status: 'available' | 'none' | 'unknown';
  providerId?: string;                // "lm-mv", "navionics", …
  surveyYear?: number;
  kind?: 'contours' | 'raster' | 'external-viewer';
  attribution?: string;
  license?: string;
}
interface DepthProvider {
  id: string;
  coverageFor(waterId: string): Promise<DepthCoverage>;
  mount(map: MapAdapter, waterId: string): Promise<() => void>;   // gibt Unmount zurück
}
```

## 7. Rechtsdaten

```ts
interface RegulationSet {                   // data/regulations/<land>.json
  stateCode: StateCode;
  status: 'verified' | 'partial' | 'draft';
  missing?: string[];                      // bei partial: was fehlt
  checkedAt: string; checkedBy: string;
  legalBasis: { id: string; title: string; version: string; url: string; retrievedAt: string }[];
  closedSeasons: ClosedSeasonRule[];
  minSizes: MinSizeRule[];
  protectedSpecies: { speciesId: string; basisRef: string; note?: string }[];
  licences: { kind: 'fishing_licence'|'permit'|'levy'|'youth'|'tourist'; text: string; basisRef: string }[];
  otherRules: { topic: string; text: string; basisRef: string }[];
}
interface ClosedSeasonRule {
  speciesId: string;
  from: { month: number; day: number }; to: { month: number; day: number };   // jahresübergreifend erlaubt
  scope?: string;                           // z. B. "nur Rheinhauptstrom"
  basisRef: string;                         // "LFischVO § 3" + legalBasis.id
  note?: string;
}
interface MinSizeRule { speciesId: string; minCm: number; scope?: string; basisRef: string; note?: string; }

interface WaterRuleSet {                    // P3: gewässerbezogen, zusätzlich zum Landesrecht
  waterId: string;
  issuer: string;                           // Verein/Verband/Behörde
  rights?: { holder: string; permitInfo?: string; url?: string };
  rules: { topic: string; text: string }[];
  zones?: { kind: 'allowed'|'forbidden'|'boat'; geometryRef: string }[];
  source: SourceRef; checkedAt: string;
}
```
Anzeige-Logik: Landesrecht und Gewässerregeln werden **getrennt** dargestellt. Die strengere Regel wird **nicht** automatisch berechnet. Die App zeigt beide nebeneinander. Hinweis im Fangformular (P1): „Laut <Land> Schonzeit für Hecht bis 30.04. (Stand …)". Das ist informativ und blockiert nicht.

## 8. Export-Format

```jsonc
{
  "format": "fangpunkt-backup",
  "formatVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-10-21T12:00:00+02:00",
  "schemaVersion": 1,
  "counts": { "catches": 12, "places": 4, "sessions": 3, "photos": 5, "baitPresets": 2 },
  "data": { "catches": [...], "places": [...], "sessions": [...], "baitPresets": [...], "settings": {...} },
  "photos": "inline-base64" | "zip-sidecar" | "omitted",
  "checksum": "sha256:…"               // über data
}
```
- Varianten: **JSON ohne Fotos** (klein, Standard) und **ZIP** (`backup.json` + `photos/<id>.jpg`).
- Import:
  1. Größe ≤ 500 MB [A].
  2. JSON parsen.
  3. `format`/`formatVersion` prüfen; ältere Versionen über Upgrader anheben.
  4. Zod-Validierung je Datensatz; ungültige werden gesammelt und nicht importiert.
  5. Prüfsumme kontrollieren.
  6. **Vorschau:** neu / identisch / Konflikt (gleiche ID, anderes `updatedAt`).
  7. Strategie wählen: „Neuere behalten" (Standard), „Datei gewinnt", „Nur neue hinzufügen".
  8. Vor dem Schreiben automatischer Sicherungs-Snapshot.
  9. Eine Transaktion; bei Fehler Rollback.
- Kompatibilität Altprojekt (**beschlossen, E9, M2**): Importer für `{app:'angelkarte',version:2}` mit Mapping `result→outcome` (`caught→caught`, `bite→missed_bite`, `lost_hooked→contact/lost_on_hook_set`, `lost_drill→contact/lost_in_fight`, `seen→observation`) und `places.type` (`platz→spot`, `steg→jetty`). Fotos (JPEG-DataURL im Feld `photo`) werden zu `Photo`-Blobs; `lake`-Namen werden nach dem Import per Name/Position einem `wid` zugeordnet (mit Bestätigung). Sessions (`start`/`end` in ms), Köder-Favoriten (`meta.favs`) und Angelplätze (`places`) werden mit übernommen; Termine (`plans`) werden ignoriert, da der Kalender P3 ist.

## 9. Statistik-Definitionen (domain/stats)

| Kennzahl | Definition | Mindestdaten für Anzeige |
|---|---|---|
| Fänge | Anzahl `outcome='caught'` | – |
| Kontakte gesamt | `caught + contact + missed_bite` | – |
| Landequote | `caught / (caught + contact)` | ≥ 5 im Nenner, sonst „zu wenige Daten" |
| Fänge pro Stunde | Fänge in Sessions / Summe Session-Dauer (abzüglich Pausen) | ≥ 1 h Angelzeit und ≥ 2 Sessions |
| Arten-Verteilung | Anzahl je `speciesId` (nur `caught`) | – (bei n < 10 Hinweis auf kleine Stichprobe) |
| Bester Köder | **Nicht** als Rangliste „bester", sondern „Fänge je Köder" mit n und Angelzeit (sofern bekannt) | ≥ 3 Köder mit Daten |
| Verlauf | Fänge je Woche/Monat, leere Perioden als 0 | – |
| Session-Vergleich | Dauer, Fänge, Kontakte, Fänge/h je Session | – |
| Rekorde | Größte gemessene Länge je Art (nur `lengthMethod='measured'`); Schätzungen separat | – |

`observation` zählt in keiner Fangkennzahl. Ungültige Sessions (Ende vor Start, > 24 h ohne Bestätigung) werden ausgeschlossen und gezählt angezeigt.

## 10. Migrationen

- Dexie `version(n).stores({...}).upgrade(tx => …)`. Jede Migration hat einen Test mit Fixture der Vorversion.
- Exportformat und DB-Schema sind **getrennt versioniert** (`formatVersion` ≠ `schemaVersion`).

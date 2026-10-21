# Gewässer-Pipeline (Spike S1, Grundlage für M4)

Erzeugt aus einem OSM-Auszug (`.osm.pbf`) die statischen Gewässerdaten der App:

| Datei | Inhalt |
|---|---|
| `water.pmtiles` | Vektorkacheln z8–14, Ebenen `areas` (Flächen) und `lines` (Flüsse, Kanäle, benannte Bäche); Attribute `wid`, `t` (Typ), `n` (Name), `mz` (Mindest-Zoom) |
| `waters.ndjson` | Ein Metadatensatz je OSM-Objekt: `wid`, Name, Typ, Fläche (ha) bzw. Länge (km), repräsentativer Punkt, Bounding Box, Land/Kreis/Gemeinde |
| `search/<xx>.json` | Suchindex nach den ersten 2 Buchstaben jedes Namensworts; Einträge `[Name, Art, lat, lng, Kontext, Rang]` |
| `report.json` | Mengen, Größen und Abdeckung (Grundlage der Hochrechnung in DATA_SOURCES.md) |

## Voraussetzungen
- `osmium-tool` ≥ 1.16 (Ubuntu 24.04: `apt-get install osmium-tool`)
- **`tippecanoe` ≥ 2.55** – die Ubuntu-Version 2.49 ist **ungeeignet**: Sie verliert Objekte (behoben in 2.52) und vertauscht bei großen Datenmengen Eigenschaften zwischen Objekten, z. B. die `wid` (String-Pool-Kollisionen, behoben in 2.55). Befund S1b, DATA_SOURCES §10.4. `run.sh` bricht bei zu alter Version ab. Bauen aus dem Quellcode (ca. 1 min):
  ```bash
  apt-get install build-essential libsqlite3-dev zlib1g-dev
  git clone --depth 1 --branch 2.79.0 https://github.com/felt/tippecanoe.git && make -C tippecanoe -j
  TIPPECANOE_DIR=$PWD/tippecanoe bash run.sh …   # oder: make -C tippecanoe install
  ```
- Node 22, pnpm

## Aufruf
```bash
pnpm install
bash run.sh <auszug.osm.pbf> <ausgabeordner>
```

## Grenzgewässer (Schritt 1b)
Gewässer-Relationen, die über den Rand des Auszugs reichen (Bodensee, Stettiner Haff …), sind im Auszug unvollständig. `run.sh` ermittelt sie mit `osmium check-refs` und lädt **genau diese** mit einer einzigen Overpass-Abfrage vollständig nach; mehrere öffentliche Overpass-Server werden der Reihe nach probiert (`OVERPASS_URL` überschreibt die Liste; `overpass-api.de` war am 2026-10-21 aus GitHub Actions nicht erreichbar). Nur beim Bauen, nie zur Laufzeit. `BORDER_WATERS=skip` überspringt den Schritt ausdrücklich (z. B. für Testdaten ohne Netz). Liefert Overpass nicht alle Relationen, bricht der Lauf ab.

## Lauf in GitHub Actions
`.github/workflows/wasserdaten.yml` (manuell oder per Push auf einen Branch `datenlauf/<datum>`): lädt den Deutschland-Auszug (Geofabrik, ersatzweise openstreetmap.fr; MD5 geprüft, hängende Downloads brechen nach 2 min ohne Datenfluss ab), baut tippecanoe 2.79.0, führt `run.sh` und die Stichprobe `src/sample.ts` aus und veröffentlicht `wasserdaten.tar.gz` als Release `wasserdaten-<datenstand>-<lauf>`. Der Pages-Workflow nimmt das neueste Release.

## Bezugsquellen für Auszüge
- Geofabrik (`download.geofabrik.de`), alle Bundesländer. War in der Cloud-Umgebung durch die Netzwerkrichtlinie gesperrt (2026-10-21).
- OpenStreetMap France: Deutschland gesamt `download.openstreetmap.fr/extracts/europe/germany-latest.osm.pbf` (5,9 GB, mit `.md5`), Länder unter `…/europe/germany/` (dort nur NRW und dessen Regierungsbezirke). Stand 2026-10-21.

Lizenz der Ausgabedaten: **ODbL 1.0** (© OpenStreetMap-Mitwirkende). Die Ausgaben werden nicht ins Repo eingecheckt.

## Regeln der Klassifizierung (Stand Spike)
- `water=lake|lagoon` → See, `pond|fishpond` → Teich, `reservoir` oder `landuse=reservoir` → Stausee/Talsperre, `river|canal|stream|oxbow|harbour` entsprechend.
- `natural=water` **ohne** `water=*` → `other` („Typ unbekannt"). Es wird kein Typ geraten.
- Ausgeschlossen (gezählt): `water=wastewater|reflecting_pool|fountain|swimming_pool|basin|pool`, `landuse=basin`.
- Unbenannte Bäche werden nicht übernommen. Unbenannte Flächen schon (in der App als „Unbenanntes Gewässer").
- Mindest-Zoom nach Fläche als Attribut `mz`: ≥ 1000 ha z6, ≥ 100 ha z8, ≥ 10 ha z10, ≥ 1 ha z12, sonst z13 (Linien: Fluss/Kanal z8, Bach z12). Umsetzung über den tippecanoe-Filter `-j` und denselben Filter im Kartenstil.
- Kein Feature-`tippecanoe.minzoom`: In 2.49 verschluckte es überlappende Nachbarn (Befund S1, behoben in 2.52). Das Attribut `mz` bleibt, weil der Kartenstil denselben Filter braucht.
- Splitter-Geometrien (< 1 m² bzw. < 2 m) werden verworfen und im Bericht als `degenerate` gezählt.
- Polygone mit mittlerer Breite (2·Fläche/Umfang) unter 0,5 m gelten ebenfalls als Splitter (Digitalisierungsstreifen, kleiner als die z14-Auflösung).
- Schritt 5 von `run.sh` (`src/verify.ts`) bricht ab, wenn ein Objekt in den z14-Kacheln fehlt **oder dort andere Eigenschaften trägt als in der Eingabe**.

## Bekannte Grenzen (für M4 zu lösen)
- Fließgewässer bestehen in OSM aus vielen Abschnitten (Ways). Die Suche fasst sie je Name + Kreis zusammen; ein Gewässerprofil „ganzer Fluss" braucht in M4 die `type=waterway`-Relationen.
- Gewässer am Rand des Auszugs liegen teils außerhalb der Landes- und Kreisgrenzen (NRW: 5,6 % ohne Kreis). Beim Deutschland-Lauf entfällt das bis auf die Staatsgrenze.
- Kreisfreie Städte haben keine Gemeindeebene (admin_level 8); dann gilt die Kreisebene.
- Ein OSM-Way kann zugleich Fläche und Fließgewässer-Linie sein und erscheint dann zweimal mit derselben `wid` (NRW: 1 Fall). Wird in M4 zusammengeführt.
- `wid` basiert auf OSM-IDs. Zur Stabilität siehe ARCHITECTURE §6.2.

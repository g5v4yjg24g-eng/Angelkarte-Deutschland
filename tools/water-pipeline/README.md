# Gewässer-Pipeline (Spike S1, Grundlage für M4)

Erzeugt aus einem OSM-Auszug (`.osm.pbf`) die statischen Gewässerdaten der App:

| Datei | Inhalt |
|---|---|
| `water.pmtiles` | Vektorkacheln z6–14, Ebenen `areas` (Flächen) und `lines` (Flüsse, Kanäle, benannte Bäche); Attribute `wid`, `t` (Typ), `n` (Name) |
| `waters.ndjson` | Ein Metadatensatz je OSM-Objekt: `wid`, Name, Typ, Fläche (ha) bzw. Länge (km), repräsentativer Punkt, Bounding Box, Land/Kreis/Gemeinde |
| `search/<xx>.json` | Suchindex nach den ersten 2 Buchstaben jedes Namensworts; Einträge `[Name, Art, lat, lng, Kontext, Rang]` |
| `report.json` | Mengen, Größen und Abdeckung (Grundlage der Hochrechnung in DATA_SOURCES.md) |

## Voraussetzungen
- `osmium-tool` ≥ 1.16, `tippecanoe` ≥ 2.17 (schreibt PMTiles direkt); unter Ubuntu 24.04: `apt-get install osmium-tool tippecanoe`
- Node 22, pnpm

## Aufruf
```bash
pnpm install
bash run.sh <auszug.osm.pbf> <ausgabeordner>
```

## Bezugsquellen für Auszüge
- Geofabrik (`download.geofabrik.de`), alle Bundesländer. War in der Cloud-Umgebung durch die Netzwerkrichtlinie gesperrt (2026-10-21).
- OpenStreetMap France (`download.openstreetmap.fr/extracts/europe/germany/`), dort nur NRW und dessen Regierungsbezirke (Stand 2026-10-21).

Lizenz der Ausgabedaten: **ODbL 1.0** (© OpenStreetMap-Mitwirkende). Die Ausgaben werden nicht ins Repo eingecheckt.

## Regeln der Klassifizierung (Stand Spike)
- `water=lake|lagoon` → See, `pond|fishpond` → Teich, `reservoir` oder `landuse=reservoir` → Stausee/Talsperre, `river|canal|stream|oxbow|harbour` entsprechend.
- `natural=water` **ohne** `water=*` → `other` („Typ unbekannt"). Es wird kein Typ geraten.
- Ausgeschlossen (gezählt): `water=wastewater|reflecting_pool|fountain|swimming_pool|basin|pool`, `landuse=basin`.
- Unbenannte Bäche werden nicht übernommen. Unbenannte Flächen schon (in der App als „Unbenanntes Gewässer").
- Mindest-Zoom nach Fläche: ≥ 1000 ha z6, ≥ 100 ha z8, ≥ 10 ha z10, ≥ 1 ha z12, sonst z13.

## Bekannte Grenzen (für M4 zu lösen)
- Fließgewässer bestehen in OSM aus vielen Abschnitten (Ways). Die Suche fasst sie je Name + Kreis zusammen; ein Gewässerprofil „ganzer Fluss" braucht in M4 die `type=waterway`-Relationen.
- Landesgrenzen (admin_level 4) fehlen in Länderauszügen oft, weil die Relation nicht vollständig enthalten ist. Für das Bundesland sollte der Auszug selbst die Quelle sein.
- `wid` basiert auf OSM-IDs. Zur Stabilität siehe ARCHITECTURE §6.2.

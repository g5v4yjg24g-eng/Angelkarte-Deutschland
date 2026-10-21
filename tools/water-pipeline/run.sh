#!/usr/bin/env bash
# Gewässer-Pipeline: OSM-PBF → gefilterte Gewässer → PMTiles + Suchindex + Metadaten.
# Aufruf: bash run.sh <eingabe.osm.pbf> <ausgabeordner>
# Benötigt: osmium-tool (≥ 1.16), tippecanoe (≥ 2.17, schreibt .pmtiles direkt), Node 22 + pnpm.
set -euo pipefail

IN=${1:?Eingabe-PBF fehlt}
OUT=${2:?Ausgabeordner fehlt}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
t0=$(date +%s)

echo "1/4 Filtern (osmium tags-filter)"
osmium tags-filter "$IN" \
  nwr/natural=water wr/water wr/landuse=reservoir,basin \
  w/waterway=river,canal,stream \
  r/boundary=administrative n/place=city,town,village,suburb \
  -o "$OUT/filtered.osm.pbf" --overwrite

echo "2/4 Export als GeoJSON-Sequenz (osmium export)"
osmium export "$OUT/filtered.osm.pbf" -c "$HERE/export-config.json" \
  --add-unique-id=type_id -f geojsonseq -o "$OUT/export.geojsonseq" --overwrite

echo "3/4 Klassifizieren, Verwaltungszuordnung, Suchindex (Node)"
node --import tsx "$HERE/src/process.ts" "$OUT/export.geojsonseq" "$OUT"

echo "4/4 Vektorkacheln (tippecanoe → PMTiles)"
tippecanoe -o "$OUT/water.pmtiles" --force \
  -Z6 -z14 --drop-smallest-as-needed --extend-zooms-if-still-dropping \
  --simplification=4 --detect-shared-borders \
  -L areas:"$OUT/tiles-areas.geojsonseq" \
  -L lines:"$OUT/tiles-lines.geojsonseq" \
  --read-parallel --quiet

echo "Fertig in $(( $(date +%s) - t0 )) s"
ls -la "$OUT"

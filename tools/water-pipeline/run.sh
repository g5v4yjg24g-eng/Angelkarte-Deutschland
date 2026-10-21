#!/usr/bin/env bash
# Gewässer-Pipeline: OSM-PBF → gefilterte Gewässer → PMTiles + Suchindex + Metadaten.
# Aufruf: bash run.sh <eingabe.osm.pbf> <ausgabeordner>
# Benötigt: osmium-tool (≥ 1.16), tippecanoe (≥ 2.55, siehe README), Node 22 + pnpm.
# Anderer tippecanoe-Pfad: TIPPECANOE_DIR=<ordner mit tippecanoe und tippecanoe-decode>.
set -euo pipefail

IN=${1:?Eingabe-PBF fehlt}
OUT=${2:?Ausgabeordner fehlt}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"
t0=$(date +%s)

TC=${TIPPECANOE_DIR:+$TIPPECANOE_DIR/}
# tippecanoe < 2.55 verliert Objekte (minzoom-Fehler, behoben in 2.52) und vertauscht Eigenschaften
# zwischen Objekten (String-Pool-Kollisionen, behoben in 2.55). Befund S1b, DATA_SOURCES §10.4.
tc_version=$("${TC}tippecanoe" --version 2>&1 | grep -o '[0-9][0-9.]*' | head -1)
if ! printf '2.55.0\n%s\n' "$tc_version" | sort -V -C; then
  echo "FEHLER: tippecanoe $tc_version ist zu alt, nötig ist ≥ 2.55 (siehe README)" >&2; exit 1
fi

echo "1/5 Filtern (osmium tags-filter)"
osmium tags-filter "$IN" \
  nwr/natural=water wr/water wr/landuse=reservoir,basin \
  w/waterway=river,canal,stream \
  r/boundary=administrative n/place=city,town,village,suburb \
  -o "$OUT/filtered.osm.pbf" --overwrite

echo "2/5 Export als GeoJSON-Sequenz (osmium export)"
osmium export "$OUT/filtered.osm.pbf" -c "$HERE/export-config.json" \
  --add-unique-id=type_id -f geojsonseq -o "$OUT/export.geojsonseq" --overwrite

echo "3/5 Klassifizieren, Verwaltungszuordnung, Suchindex (Node)"
# Datenstand aus dem PBF-Kopf (Replikationszeitpunkt des Auszugs)
# (Zugeschnittene Auszüge verlieren ihn – dann DATA_DATE von außen übergeben.)
DATA_DATE=${DATA_DATE:-$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$IN" 2>/dev/null || true)}
DATA_DATE="$DATA_DATE" SOURCE_NAME="$(basename "$IN")" \
  node --max-old-space-size=6144 --import tsx "$HERE/src/process.ts" "$OUT/export.geojsonseq" "$OUT"

echo "4/5 Vektorkacheln (tippecanoe → PMTiles)"
# Zoomfilter über das Attribut mz (Mindest-Zoom), den auch der Kartenstil nutzt. Kein Feature-"tippecanoe.minzoom"
# (in 2.49 fehlerhaft, Befund S1). Bei z14 keine Kleinstflächen-Zusammenfassung: Jeder Teich soll antippbar sein.
MZ_FILTER='["any",["all",["==","mz",6],[">=","$zoom",6]],["all",["==","mz",8],[">=","$zoom",8]],["all",["==","mz",10],[">=","$zoom",10]],["all",["==","mz",12],[">=","$zoom",12]],["all",["==","mz",13],[">=","$zoom",13]]]'
"${TC}tippecanoe" -o "$OUT/water.pmtiles" --force \
  -Z8 -z14 --drop-smallest-as-needed --no-tiny-polygon-reduction-at-maximum-zoom \
  -j "{\"*\":$MZ_FILTER}" \
  --simplification=4 \
  -L areas:"$OUT/tiles-areas.geojsonseq" \
  -L lines:"$OUT/tiles-lines.geojsonseq" \
  --read-parallel --quiet

echo "5/5 Prüfung: jedes Objekt steht bei z14 in den Kacheln, mit unveränderten Eigenschaften"
"${TC}tippecanoe-decode" -Z14 -z14 "$OUT/water.pmtiles" \
  | node --max-old-space-size=6144 --import tsx "$HERE/src/verify.ts" "$OUT"

echo "Fertig in $(( $(date +%s) - t0 )) s"
ls -la "$OUT"

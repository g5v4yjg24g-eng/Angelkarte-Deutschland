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
# Datenstand aus dem PBF-Kopf (Replikationszeitpunkt des Auszugs)
# (Zugeschnittene Auszüge verlieren ihn – dann DATA_DATE von außen übergeben.)
DATA_DATE=${DATA_DATE:-$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$IN" 2>/dev/null || true)}
DATA_DATE="$DATA_DATE" SOURCE_NAME="$(basename "$IN")" \
  node --max-old-space-size=6144 --import tsx "$HERE/src/process.ts" "$OUT/export.geojsonseq" "$OUT"

echo "4/4 Vektorkacheln (tippecanoe → PMTiles)"
# Zoomfilter über das Attribut mz (Mindest-Zoom). Feature-"tippecanoe.minzoom" wird bewusst nicht
# verwendet: In tippecanoe 2.49 verschluckt es überlappende Nachbarn (Befund Spike S1).
MZ_FILTER='["any",["all",["==","mz",6],[">=","$zoom",6]],["all",["==","mz",8],[">=","$zoom",8]],["all",["==","mz",10],[">=","$zoom",10]],["all",["==","mz",12],[">=","$zoom",12]],["all",["==","mz",13],[">=","$zoom",13]]]'
tippecanoe -o "$OUT/water.pmtiles" --force \
  -Z8 -z14 --drop-smallest-as-needed \
  -j "{\"*\":$MZ_FILTER}" \
  --simplification=4 \
  -L areas:"$OUT/tiles-areas.geojsonseq" \
  -L lines:"$OUT/tiles-lines.geojsonseq" \
  --read-parallel --quiet

echo "5/5 Vollständigkeit: jedes Objekt muss bei z14 in den Kacheln stehen"
cat "$OUT/tiles-areas.geojsonseq" "$OUT/tiles-lines.geojsonseq" | grep -o '"wid":"osm:[^"]*"' | cut -d'"' -f4 | sort -u > "$OUT/check-expected.txt"
tippecanoe-decode -Z14 -z14 "$OUT/water.pmtiles" | grep -o '"wid": "osm:[^"]*"' | cut -d'"' -f4 | sort -u > "$OUT/check-tiles.txt"
comm -23 "$OUT/check-expected.txt" "$OUT/check-tiles.txt" > "$OUT/check-missing.txt"
echo "  erwartet: $(wc -l < "$OUT/check-expected.txt")  fehlend in z14-Kacheln: $(wc -l < "$OUT/check-missing.txt")"
if [ -s "$OUT/check-missing.txt" ]; then
  echo "FEHLER: Objekte fehlen in den Kacheln (Liste: $OUT/check-missing.txt)" >&2; head -20 "$OUT/check-missing.txt" >&2; exit 1
fi
rm -f "$OUT"/check-*.txt

echo "Fertig in $(( $(date +%s) - t0 )) s"
ls -la "$OUT"

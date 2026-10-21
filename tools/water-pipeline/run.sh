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

echo "1b/5 Grenzgewässer vervollständigen"
# Gewässer-Relationen, die über den Rand des Auszugs reichen (z. B. Bodensee, Stettiner Haff), sind im Auszug
# unvollständig und würden ganz wegfallen. Sie werden mit EINER Overpass-Abfrage vollständig nachgeladen
# (nur beim Bauen, nie zur Laufzeit der App). BORDER_WATERS=skip überspringt den Schritt ausdrücklich.
osmium tags-filter "$OUT/filtered.osm.pbf" r/natural=water r/water r/landuse=reservoir,basin -R -f opl -o - \
  | awk '/^r/{print $1}' | sort -u > "$OUT/water-relations.txt"
# Relationen mit fehlenden Mitgliedern (check-refs endet mit Fehlercode, sobald irgendetwas fehlt)
incomplete_relations() { { osmium check-refs -r -i "$1" 2>/dev/null || true; } | awk '$2=="in"{print $3}' | sort -u; }
incomplete_relations "$OUT/filtered.osm.pbf" | comm -12 - "$OUT/water-relations.txt" > "$OUT/border-relations.txt"
n_border=$(wc -l < "$OUT/border-relations.txt")
BORDER_SUPPLEMENT=""
if [ "$n_border" -eq 0 ]; then
  echo "  keine unvollständigen Gewässer-Relationen"
elif [ "${BORDER_WATERS:-fetch}" = skip ]; then
  echo "  $n_border unvollständige Gewässer-Relationen werden ausgelassen (BORDER_WATERS=skip)"
else
  ids=$(sed 's/^r//' "$OUT/border-relations.txt" | paste -sd,)
  # Mehrere öffentliche Overpass-Server (gleiche OSM-Daten); der erste erreichbare liefert
  OVERPASS_URLS=${OVERPASS_URL:-https://overpass-api.de/api/interpreter https://overpass.private.coffee/api/interpreter https://overpass.kumi.systems/api/interpreter https://maps.mail.ru/osm/tools/overpass/api/interpreter}
  echo "  $n_border unvollständige Gewässer-Relationen"
  fetched=""
  for url in $OVERPASS_URLS; do
    echo "  Abfrage bei $url"
    if curl -sS --fail --retry 2 --retry-delay 20 --connect-timeout 30 --max-time 600 \
         -A "Fangpunkt-Gewaesserpipeline/1 (nicht kommerziell; https://github.com/g5v4yjg24g-eng/Angelkarte-Deutschland)" \
         --data-urlencode "data=[out:xml][timeout:300];rel(id:$ids);(._;>;);out meta;" \
         "$url" -o "$OUT/border-waters.osm" && grep -q '<relation ' "$OUT/border-waters.osm"; then
      fetched=$url; break
    fi
  done
  if [ -z "$fetched" ]; then echo "FEHLER: kein Overpass-Server erreichbar" >&2; exit 1; fi
  got=$(grep -c '<relation ' "$OUT/border-waters.osm" || true)
  if [ "$got" -ne "$n_border" ]; then
    echo "FEHLER: Overpass lieferte $got von $n_border Relationen" >&2; exit 1
  fi
  # Neuere Versionen aus Overpass ersetzen die Objekte des Auszugs (keine doppelten Versionen)
  osmium apply-changes "$OUT/filtered.osm.pbf" "$OUT/border-waters.osm" -o "$OUT/filtered-full.osm.pbf" --overwrite
  mv "$OUT/filtered-full.osm.pbf" "$OUT/filtered.osm.pbf"
  left=$(incomplete_relations "$OUT/filtered.osm.pbf" | comm -12 - "$OUT/border-relations.txt" | wc -l)
  if [ "$left" -ne 0 ]; then echo "FEHLER: $left Relationen bleiben unvollständig" >&2; exit 1; fi
  BORDER_SUPPLEMENT="$n_border Relationen über Overpass API ergänzt ($(echo "$fetched" | cut -d/ -f3)), Abruf $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "  $BORDER_SUPPLEMENT"
fi

echo "2/5 Export als GeoJSON-Sequenz (osmium export)"
osmium export "$OUT/filtered.osm.pbf" -c "$HERE/export-config.json" \
  --add-unique-id=type_id -f geojsonseq -o "$OUT/export.geojsonseq" --overwrite

echo "3/5 Klassifizieren, Verwaltungszuordnung, Suchindex (Node)"
# Datenstand aus dem PBF-Kopf (Replikationszeitpunkt des Auszugs)
# (Zugeschnittene Auszüge verlieren ihn – dann DATA_DATE von außen übergeben.)
DATA_DATE=${DATA_DATE:-$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$IN" 2>/dev/null || true)}
DATA_DATE="$DATA_DATE" SOURCE_NAME="$(basename "$IN")" SOURCE_SUPPLEMENT="$BORDER_SUPPLEMENT" \
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

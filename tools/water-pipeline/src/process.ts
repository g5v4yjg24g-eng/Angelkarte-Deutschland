// Verarbeitet den osmium-Export (GeoJSON-Sequenz) zu:
//  - tiles-areas.geojsonseq / tiles-lines.geojsonseq  (Eingabe für tippecanoe)
//  - waters.ndjson   (Gewässer-Metadaten, ein Datensatz pro OSM-Objekt)
//  - search/<shard>.json  (Suchindex, nach Token-Präfix geteilt)
//  - report.json     (Mengen, Größen, Abdeckung – Grundlage für die Hochrechnung)
// Aufruf: node --import tsx src/process.ts <export.geojsonseq> <ausgabeordner>
import { createReadStream, mkdirSync, rmSync, writeFileSync, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Feature, Geometry, LineString, MultiPolygon, Point, Polygon, Position } from 'geojson';
import area from '@turf/area';
import length from '@turf/length';
import pointOnFeature from '@turf/point-on-feature';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import Flatbush from 'flatbush';

type Tags = Record<string, string>;
type WaterType = 'lake' | 'pond' | 'reservoir' | 'river' | 'canal' | 'stream' | 'oxbow' | 'harbour' | 'other';
type Bbox = [number, number, number, number];

interface Admin { level: 4 | 6 | 8; name: string; geom: Polygon | MultiPolygon; bbox: Bbox }
interface WaterRecord {
  wid: string; n?: string; t: WaterType;
  ha?: number; km?: number;
  c: [number, number];             // [lat, lng], repräsentativer Punkt
  bb: Bbox;                        // [minLng, minLat, maxLng, maxLat]
  adm: { s?: string; k?: string; g?: string };
}

const [inputArg, outArg] = process.argv.slice(2);
if (!inputArg || !outArg) throw new Error('Aufruf: process.ts <export.geojsonseq> <ausgabeordner>');
const input: string = inputArg, outDir: string = outArg;

// OSM water=* → App-Typ. Nicht gelistete Werte → 'other'.
const WATER_TYPE: Record<string, WaterType> = {
  lake: 'lake', lagoon: 'lake', pond: 'pond', fishpond: 'pond', reservoir: 'reservoir',
  river: 'river', canal: 'canal', stream: 'stream', oxbow: 'oxbow', harbour: 'harbour',
};
// Für Angler irrelevante Wasserflächen: werden gezählt, aber nicht übernommen.
const EXCLUDED_WATER = new Set(['wastewater', 'reflecting_pool', 'fountain', 'swimming_pool', 'basin', 'pool']);
const KREIS_LEVEL = 6, GEMEINDE_LEVEL = 8, LAND_LEVEL = 4;

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
// GeoJSON-Position → [lng, lat] (Höhenwert wird ignoriert)
const lngLat = (p: Position): [number, number] => [p[0] ?? 0, p[1] ?? 0];

function bboxOf(g: Geometry): Bbox {
  const b: Bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (p: Position) => {
    const [x, y] = lngLat(p);
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  };
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') visit(c as Position); else (c as unknown[]).forEach(walk);
  };
  if (g.type !== 'GeometryCollection') walk(g.coordinates);
  return b.map(r6) as Bbox;
}

function areaType(tags: Tags): WaterType | 'excluded' | null {
  if (tags.boundary === 'administrative') return null;
  if (tags.water) return EXCLUDED_WATER.has(tags.water) ? 'excluded' : WATER_TYPE[tags.water] ?? 'other';
  if (tags.landuse === 'reservoir') return 'reservoir';
  if (tags.landuse === 'basin') return 'excluded';
  if (tags.natural === 'water') return 'other';   // ohne water=* keine Typ-Vermutung
  return null;
}

// Mindest-Zoom nach Größe, damit kleine Teiche erst nah sichtbar werden.
function areaMinZoom(ha: number): number {
  return ha >= 1000 ? 6 : ha >= 100 ? 8 : ha >= 10 ? 10 : ha >= 1 ? 12 : 13;
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function main(): Promise<void> {
  const admins: Admin[] = [];
  const places: { n: string; kind: string; c: [number, number] }[] = [];
  const waters: WaterRecord[] = [];
  const tilesAreas: string[] = [], tilesLines: string[] = [];
  const counts = { excludedAreas: 0, unnamedAreas: 0, unnamedLinesSkipped: 0, tinyAreasUnder01ha: 0, otherGeometry: 0 };

  const rl = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.replace(/^\x1e/, '').trim();   // RFC 8142: Record-Separator
    if (!line) continue;
    const f = JSON.parse(line) as Feature<Geometry, Tags> & { id: string };
    const tags = f.properties ?? {}, g = f.geometry;

    if (tags.boundary === 'administrative' && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
      const level = Number(tags.admin_level);
      if ((level === LAND_LEVEL || level === KREIS_LEVEL || level === GEMEINDE_LEVEL) && tags.name)
        admins.push({ level: level as Admin['level'], name: tags.name, geom: g, bbox: bboxOf(g) });
      continue;
    }
    if (g.type === 'Point') {
      if (tags.place && tags.name) {
        const [lng, lat] = lngLat((g as Point).coordinates);
        places.push({ n: tags.name, kind: tags.place, c: [r6(lat), r6(lng)] });
      }
      continue;
    }
    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const t = areaType(tags);
      if (t === null) continue;
      if (t === 'excluded') { counts.excludedAreas++; continue; }
      const ha = area(f) / 1e4;
      if (ha < 0.1) counts.tinyAreasUnder01ha++;
      if (!tags.name) counts.unnamedAreas++;
      const [lng, lat] = lngLat(pointOnFeature(f).geometry.coordinates);
      waters.push({ wid: `osm:${f.id}`, n: tags.name, t, ha: Math.round(ha * 100) / 100,
        c: [r6(lat), r6(lng)], bb: bboxOf(g), adm: {} });
      tilesAreas.push(JSON.stringify({ type: 'Feature', tippecanoe: { minzoom: areaMinZoom(ha) },
        properties: { wid: `osm:${f.id}`, t, ...(tags.name ? { n: tags.name } : {}) }, geometry: g }));
      continue;
    }
    if (g.type === 'LineString' && tags.waterway) {
      const t: WaterType = tags.waterway === 'canal' ? 'canal' : tags.waterway === 'river' ? 'river' : 'stream';
      if (t === 'stream' && !tags.name) { counts.unnamedLinesSkipped++; continue; }
      const coords = (g as LineString).coordinates, [mlng, mlat] = lngLat(coords[Math.floor(coords.length / 2)] ?? [0, 0]);
      waters.push({ wid: `osm:${f.id}`, n: tags.name, t, km: Math.round(length(f) * 100) / 100,
        c: [r6(mlat), r6(mlng)], bb: bboxOf(g), adm: {} });
      tilesLines.push(JSON.stringify({ type: 'Feature', tippecanoe: { minzoom: t === 'stream' ? 12 : 8 },
        properties: { wid: `osm:${f.id}`, t, ...(tags.name ? { n: tags.name } : {}) }, geometry: g }));
      continue;
    }
    counts.otherGeometry++;
  }

  // Verwaltungszuordnung über den repräsentativen Punkt
  const index = new Flatbush(Math.max(admins.length, 1));
  for (const a of admins) index.add(a.bbox[0], a.bbox[1], a.bbox[2], a.bbox[3]);
  if (!admins.length) index.add(0, 0, 0, 0);
  index.finish();
  const key = { 4: 's', 6: 'k', 8: 'g' } as const;
  for (const w of waters) {
    const [lat, lng] = w.c, pt: Position = [lng, lat];
    for (const i of index.search(lng, lat, lng, lat)) {
      const a = admins[i];
      if (a && booleanPointInPolygon(pt, a.geom)) w.adm[key[a.level]] = a.name;
    }
  }

  // Suchindex: benannte Gewässer, Fließgewässer je Name+Kreis zusammengefasst, plus Orte.
  type Entry = [name: string, kind: string, lat: number, lng: number, context: string, rank: number];
  const entries: Entry[] = [];
  const lineGroups = new Map<string, WaterRecord[]>();
  for (const w of waters) {
    if (!w.n) continue;
    if (w.km !== undefined) {
      const k = `${w.n}|${w.t}|${w.adm.k ?? ''}`;
      (lineGroups.get(k) ?? lineGroups.set(k, []).get(k)!).push(w);
    } else entries.push([w.n, w.t, w.c[0], w.c[1], w.adm.g ?? w.adm.k ?? '', Math.round(Math.log10(1 + (w.ha ?? 0)) * 100)]);
  }
  for (const group of lineGroups.values()) {
    const w = group[Math.floor(group.length / 2)]!, km = group.reduce((s, x) => s + (x.km ?? 0), 0);
    entries.push([w.n!, w.t, w.c[0], w.c[1], w.adm.k ?? '', Math.round(Math.log10(1 + km * 10) * 100)]);
  }
  for (const p of places) entries.push([p.n, `place:${p.kind}`, p.c[0], p.c[1], '', 0]);

  const shards = new Map<string, Entry[]>();
  for (const e of entries) {
    const prefixes = new Set(normalize(e[0]).split(' ').filter((t) => t.length >= 2).map((t) => t.slice(0, 2)));
    for (const p of prefixes) (shards.get(p) ?? shards.set(p, []).get(p)!).push(e);
  }
  rmSync(join(outDir, 'search'), { recursive: true, force: true });
  mkdirSync(join(outDir, 'search'), { recursive: true });
  let searchRaw = 0, searchGz = 0, maxShardGz = 0, maxShard = '';
  for (const [p, list] of shards) {
    const json = JSON.stringify(list), gz = gzipSync(json).length;
    writeFileSync(join(outDir, 'search', `${p}.json`), json);
    searchRaw += json.length; searchGz += gz;
    if (gz > maxShardGz) { maxShardGz = gz; maxShard = p; }
  }

  const watersOut = createWriteStream(join(outDir, 'waters.ndjson'));
  let watersRaw = '';
  for (const w of waters) { const s = JSON.stringify(w) + '\n'; watersRaw += s; watersOut.write(s); }
  watersOut.end();
  writeFileSync(join(outDir, 'tiles-areas.geojsonseq'), tilesAreas.join('\n') + '\n');
  writeFileSync(join(outDir, 'tiles-lines.geojsonseq'), tilesLines.join('\n') + '\n');

  const byType: Record<string, { count: number; named: number }> = {};
  for (const w of waters) {
    const b = (byType[w.t] ??= { count: 0, named: 0 });
    b.count++; if (w.n) b.named++;
  }
  const areasHa = waters.filter((w) => w.ha !== undefined).map((w) => w.ha!).sort((a, b) => a - b);
  const q = (p: number) => areasHa[Math.floor((areasHa.length - 1) * p)] ?? 0;
  const report = {
    input, generatedAt: new Date().toISOString(),
    admins: { land: admins.filter((a) => a.level === 4).length, kreis: admins.filter((a) => a.level === 6).length,
      gemeinde: admins.filter((a) => a.level === 8).length },
    places: places.length,
    waters: { total: waters.length, areas: areasHa.length, lines: waters.length - areasHa.length, byType, ...counts },
    areaHaQuantiles: { p10: q(0.1), p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1) },
    adminCoverage: {
      gemeinde: waters.filter((w) => w.adm.g).length / Math.max(waters.length, 1),
      kreis: waters.filter((w) => w.adm.k).length / Math.max(waters.length, 1),
      land: waters.filter((w) => w.adm.s).length / Math.max(waters.length, 1),
    },
    search: { entries: entries.length, shards: shards.size, rawBytes: searchRaw, gzipBytes: searchGz,
      maxShard, maxShardGzipBytes: maxShardGz },
    watersMeta: { rawBytes: watersRaw.length, gzipBytes: gzipSync(watersRaw).length },
  };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

await main();

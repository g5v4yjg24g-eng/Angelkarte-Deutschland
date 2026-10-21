// Verarbeitet den osmium-Export (GeoJSON-Sequenz) zu:
//  - tiles-areas.geojsonseq / tiles-lines.geojsonseq  (Eingabe für tippecanoe; Profilfelder stecken in den Kacheln)
//  - search/<xx>.json + search/index.json             (Suchindex, nach Wort-Präfix geteilt)
//  - water-manifest.json                              (Datenstand, Lizenz, Abdeckung)
//  - report.json                                      (Mengen und Größen, Grundlage für DATA_SOURCES.md)
// Zwei Durchläufe über die Exportdatei, damit auch der Deutschland-Auszug nicht komplett im Speicher liegt.
// Aufruf: DATA_DATE=<iso> SOURCE_NAME=<datei> node --import tsx src/process.ts <export.geojsonseq> <ausgabeordner>
import { createReadStream, createWriteStream, mkdirSync, rmSync, writeFileSync, type WriteStream } from 'node:fs';
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
type ExportFeature = Feature<Geometry, Tags> & { id: string };

interface Admin {
  level: 4 | 6 | 8;
  name: string;
  geom: Polygon | MultiPolygon;
  bbox: Bbox;
}
interface Adm {
  s?: string;
  k?: string;
  g?: string;
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

// Bundesländer (admin_level 4) → Kürzel wie in DATA_MODEL (StateCode). Andere Staaten bleiben ohne Kürzel.
const STATE_CODES: [RegExp, string][] = [
  [/^Baden-Württemberg$/, 'BW'], [/^(Freistaat )?Bayern$/, 'BY'], [/^Berlin$/, 'BE'], [/^Brandenburg$/, 'BB'],
  [/Bremen$/, 'HB'], [/Hamburg$/, 'HH'], [/^Hessen$/, 'HE'], [/^Mecklenburg-Vorpommern$/, 'MV'],
  [/^Niedersachsen$/, 'NI'], [/^Nordrhein-Westfalen$/, 'NW'], [/^Rheinland-Pfalz$/, 'RP'], [/^Saarland$/, 'SL'],
  [/^(Freistaat )?Sachsen$/, 'SN'], [/^Sachsen-Anhalt$/, 'ST'], [/^Schleswig-Holstein$/, 'SH'], [/^(Freistaat )?Thüringen$/, 'TH'],
];
export const stateCode = (name: string) => STATE_CODES.find(([re]) => re.test(name))?.[1];

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
// GeoJSON-Position → [lng, lat] (Höhenwert wird ignoriert)
const lngLat = (p: Position): [number, number] => [p[0] ?? 0, p[1] ?? 0];

// osmium vergibt für Flächen eigene IDs ("a" + 2·Way-ID bzw. 2·Relation-ID+1). Für stabile Bezüge
// zur OSM-Datenbank wird daraus wieder die Original-ID gemacht: "osm:w<id>" bzw. "osm:r<id>".
export function osmWid(exportId: string): string {
  const kind = exportId[0], num = Number(exportId.slice(1));
  if (kind === 'a') return num % 2 === 0 ? `osm:w${num / 2}` : `osm:r${(num - 1) / 2}`;
  return `osm:${exportId}`;
}

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
  if (tags.natural === 'water') return 'other'; // ohne water=* keine Typ-Vermutung
  return null;
}

// Mindest-Zoom nach Größe, damit kleine Teiche erst nah sichtbar werden.
function areaMinZoom(ha: number): number {
  return ha >= 1000 ? 6 : ha >= 100 ? 8 : ha >= 10 ? 10 : ha >= 1 ? 12 : 13;
}

export /** Weitere Namen aus OSM-Tags, die vom Hauptnamen abweichen (für die Suche). */
function altNames(tags: Record<string, string>): string[] {
  const main = normalize(tags.name ?? '');
  const names = ['name:de', 'alt_name', 'official_name', 'alt_name:de']
    .flatMap((k) => (tags[k] ?? '').split(';'))
    .map((n) => n.trim())
    .filter((n) => n && normalize(n) !== main);
  return [...new Map(names.map((n) => [normalize(n), n])).values()];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function* features(file: string): AsyncGenerator<ExportFeature> {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.replace(/^\x1e/, '').trim(); // RFC 8142: Record-Separator
    if (line) yield JSON.parse(line) as ExportFeature;
  }
}

/** Schreibt mit Rücksicht auf Gegendruck (große Ausgaben). */
function writer(path: string) {
  const ws: WriteStream = createWriteStream(path);
  return {
    async write(s: string) {
      if (!ws.write(s)) await new Promise((r) => ws.once('drain', r));
    },
    end: () => new Promise<void>((r) => ws.end(r)),
  };
}

async function main(): Promise<void> {
  // ---------- Durchlauf 1: Verwaltungsgrenzen und Orte ----------
  const admins: Admin[] = [];
  const places: { n: string; kind: string; c: [number, number]; adm: Adm }[] = [];
  for await (const f of features(input)) {
    const tags = f.properties ?? {}, g = f.geometry;
    if (tags.boundary === 'administrative' && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
      const level = Number(tags.admin_level);
      if ((level === 4 || level === 6 || level === 8) && tags.name)
        admins.push({ level: level as Admin['level'], name: tags.name, geom: g, bbox: bboxOf(g) });
    } else if (g.type === 'Point' && tags.place && tags.name) {
      const [lng, lat] = lngLat((g as Point).coordinates);
      places.push({ n: tags.name, kind: tags.place, c: [r6(lat), r6(lng)], adm: {} });
    }
  }
  const index = new Flatbush(Math.max(admins.length, 1));
  for (const a of admins) index.add(a.bbox[0], a.bbox[1], a.bbox[2], a.bbox[3]);
  if (!admins.length) index.add(0, 0, 0, 0);
  index.finish();
  const adminAt = (lng: number, lat: number): Adm => {
    const adm: Adm = {};
    for (const i of index.search(lng, lat, lng, lat)) {
      const a = admins[i];
      if (!a || !booleanPointInPolygon([lng, lat], a.geom)) continue;
      if (a.level === 4) {
        const code = stateCode(a.name);
        if (code) adm.s = code;
      } else if (a.level === 6) adm.k = a.name;
      else adm.g = a.name;
    }
    return adm;
  };
  for (const p of places) p.adm = adminAt(p.c[1], p.c[0]);

  // ---------- Durchlauf 2: Gewässer ----------
  const counts = { degenerate: 0, excludedAreas: 0, unnamedAreas: 0, unnamedLinesSkipped: 0, tinyAreasUnder01ha: 0 };
  const byType: Record<string, { count: number; named: number }> = {};
  const byState: Record<string, number> = {};
  const areasHa: number[] = [];
  let total = 0, lines = 0, withState = 0, withKreis = 0, withGemeinde = 0;
  type Entry = [name: string, kind: string, lat: number, lng: number, context: string, rank: number, wid: string];
  const entries: Entry[] = [];
  const lineGroups = new Map<string, { n: string; t: WaterType; c: [number, number]; km: number; ctx: string; wid: string }>();
  const areasOut = writer(join(outDir, 'tiles-areas.geojsonseq'));
  const linesOut = writer(join(outDir, 'tiles-lines.geojsonseq'));

  const account = (t: WaterType, named: boolean, adm: Adm) => {
    const b = (byType[t] ??= { count: 0, named: 0 });
    b.count++;
    if (named) b.named++;
    total++;
    if (adm.s) { withState++; byState[adm.s] = (byState[adm.s] ?? 0) + 1; }
    if (adm.k) withKreis++;
    if (adm.g) withGemeinde++;
  };

  for await (const f of features(input)) {
    const tags = f.properties ?? {}, g = f.geometry;
    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const t = areaType(tags);
      if (t === null) continue;
      if (t === 'excluded') { counts.excludedAreas++; continue; }
      const ha = area(f) / 1e4;
      if (ha < 1e-4) { counts.degenerate++; continue; } // < 1 m²: Splitter, kein Gewässer
      // Mittlere Breite 2·Fläche/Umfang < 0,5 m: Digitalisierungsstreifen, fällt bei z14 unter die Kachelauflösung
      if ((2 * ha * 1e4) / (length(f) * 1000) < 0.5) { counts.degenerate++; continue; }
      if (ha < 0.1) counts.tinyAreasUnder01ha++;
      if (!tags.name) counts.unnamedAreas++;
      const wid = osmWid(f.id);
      const [lng, lat] = lngLat(pointOnFeature(f).geometry.coordinates);
      const adm = adminAt(lng, lat);
      account(t, !!tags.name, adm);
      areasHa.push(ha);
      if (tags.name) {
        const rank = Math.round(Math.log10(1 + ha) * 100), ctx = adm.g ?? adm.k ?? '';
        entries.push([tags.name, t, r6(lat), r6(lng), ctx, rank, wid]);
        // Weitere Namen aus OSM (z. B. Möhnetalsperre: name:de=Möhnesee), angezeigt als „Weiterer Name (Name)"
        for (const alt of altNames(tags)) entries.push([`${alt} (${tags.name})`, t, r6(lat), r6(lng), ctx, rank, wid]);
      }
      // Kein Feature-"tippecanoe.minzoom": verschluckt in tippecanoe 2.49 überlappende Nachbarn (Spike S1).
      // Stattdessen Attribut mz, nach dem tippecanoe (-j) und der Kartenstil filtern.
      await areasOut.write(JSON.stringify({ type: 'Feature', properties: {
        wid, t, mz: areaMinZoom(ha), ha: Math.round(ha * 100) / 100,
        ...(tags.name ? { n: tags.name } : {}), ...adm }, geometry: g }) + '\n');
    } else if (g.type === 'LineString' && tags.waterway) {
      const t: WaterType = tags.waterway === 'canal' ? 'canal' : tags.waterway === 'river' ? 'river' : 'stream';
      if (t === 'stream' && !tags.name) { counts.unnamedLinesSkipped++; continue; }
      const km = length(f);
      if (km < 0.002) { counts.degenerate++; continue; } // < 2 m: Splitter
      const wid = osmWid(f.id), coords = (g as LineString).coordinates;
      const [lng, lat] = lngLat(coords[Math.floor(coords.length / 2)] ?? [0, 0]);
      const adm = adminAt(lng, lat);
      account(t, !!tags.name, adm);
      lines++;
      // Fließgewässer bestehen aus vielen Abschnitten: für die Suche je Name + Kreis zusammenfassen
      if (tags.name) {
        const key = `${tags.name}|${t}|${adm.k ?? ''}`;
        const grp = lineGroups.get(key);
        if (grp) grp.km += km;
        else lineGroups.set(key, { n: tags.name, t, c: [r6(lat), r6(lng)], km, ctx: adm.k ?? adm.g ?? '', wid });
      }
      await linesOut.write(JSON.stringify({ type: 'Feature', properties: {
        wid, t, mz: t === 'stream' ? 12 : 8, ...(tags.name ? { n: tags.name } : {}), ...adm }, geometry: g }) + '\n');
    }
  }
  await areasOut.end();
  await linesOut.end();

  for (const grp of lineGroups.values())
    entries.push([grp.n, grp.t, grp.c[0], grp.c[1], grp.ctx, Math.round(Math.log10(1 + grp.km * 10) * 100), grp.wid]);
  for (const p of places) entries.push([p.n, `place:${p.kind}`, p.c[0], p.c[1], p.adm.k ?? '', 0, '']);

  // ---------- Suchindex ----------
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
  writeFileSync(join(outDir, 'search', 'index.json'), JSON.stringify([...shards.keys()].sort()));

  // ---------- Manifest ----------
  const dataDate = process.env.DATA_DATE ?? '';
  writeFileSync(join(outDir, 'water-manifest.json'), JSON.stringify({
    format: 'fangpunkt-water',
    formatVersion: 1,
    dataDate,
    generatedAt: new Date().toISOString(),
    source: {
      name: 'OpenStreetMap',
      extract: process.env.SOURCE_NAME ?? input,
      license: 'ODbL-1.0',
      attribution: '© OpenStreetMap-Mitwirkende',
      url: 'https://www.openstreetmap.org/copyright',
    },
    coverage: Object.keys(byState).sort(),
    tiles: 'water.pmtiles',
    search: 'search/',
  }, null, 2));

  areasHa.sort((a, b) => a - b);
  const q = (p: number) => Math.round((areasHa[Math.floor((areasHa.length - 1) * p)] ?? 0) * 100) / 100;
  const report = {
    input, dataDate, generatedAt: new Date().toISOString(),
    admins: { land: admins.filter((a) => a.level === 4).length, kreis: admins.filter((a) => a.level === 6).length,
      gemeinde: admins.filter((a) => a.level === 8).length },
    places: places.length,
    waters: { total, areas: areasHa.length, lines, byType, byState, ...counts },
    areaHaQuantiles: { p10: q(0.1), p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1) },
    adminCoverage: { land: withState / Math.max(total, 1), kreis: withKreis / Math.max(total, 1), gemeinde: withGemeinde / Math.max(total, 1) },
    search: { entries: entries.length, shards: shards.size, rawBytes: searchRaw, gzipBytes: searchGz, maxShard, maxShardGzipBytes: maxShardGz },
  };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

await main();

// Gewässer aus den Kartenkacheln der Pipeline (DATA_MODEL §3, Datenstufe 1).
import { z } from 'zod';

export const WATER_TYPES = [
  'lake',
  'pond',
  'reservoir',
  'river',
  'canal',
  'stream',
  'oxbow',
  'harbour',
  'other',
] as const;
export type WaterType = (typeof WATER_TYPES)[number];
export const STATE_CODES = [
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const;
export type StateCode = (typeof STATE_CODES)[number];

/** Eigenschaften eines Gewässers in den Kacheln (tools/water-pipeline/src/process.ts). */
const TilePropsSchema = z.object({
  wid: z.string().regex(/^osm:[wr]\d+$/),
  t: z.enum(WATER_TYPES).catch('other'),
  n: z.string().optional(),
  ha: z.number().nonnegative().optional(),
  s: z.enum(STATE_CODES).optional().catch(undefined),
  k: z.string().optional(),
  g: z.string().optional(),
});

export interface WaterInfo {
  wid: string;
  name?: string;
  type: WaterType;
  /** aus der Kartengeometrie berechnet, nur bei Flächen */
  areaHa?: number;
  isLine: boolean;
  state?: StateCode;
  district?: string;
  municipality?: string;
}

/** Kachel-Eigenschaften → WaterInfo; undefined bei unbrauchbaren Daten (wird nie geraten). */
export function waterFromTile(props: Record<string, unknown>, isLine: boolean): WaterInfo | undefined {
  const r = TilePropsSchema.safeParse(props);
  if (!r.success) return undefined;
  const p = r.data;
  return Object.fromEntries(
    Object.entries({
      wid: p.wid,
      name: p.n,
      type: p.t,
      areaHa: isLine ? undefined : p.ha,
      isLine,
      state: p.s,
      district: p.k,
      municipality: p.g,
    }).filter(([, v]) => v !== undefined),
  ) as unknown as WaterInfo;
}

/** Link zum OSM-Objekt (Quelle zeigen, Fehler in OSM selbst melden). */
export function osmUrl(wid: string): string | undefined {
  const m = /^osm:([wr])(\d+)$/.exec(wid);
  return m ? `https://www.openstreetmap.org/${m[1] === 'w' ? 'way' : 'relation'}/${m[2]}` : undefined;
}

export const WaterManifestSchema = z.object({
  format: z.literal('fangpunkt-water'),
  formatVersion: z.literal(1),
  dataDate: z.string(),
  source: z.object({ name: z.string(), license: z.string(), attribution: z.string(), url: z.string() }),
  coverage: z.array(z.string()),
  tiles: z.string(),
  search: z.string(),
});
export type WaterManifest = z.infer<typeof WaterManifestSchema>;

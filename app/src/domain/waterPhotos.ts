// Fotos zu Gewässern aus Wikimedia Commons (Wunsch Nutzer 2026-11-11). Die Pipeline löst pro Gewässer das Bild über
// die OSM-Tags `wikidata` (Wikidata-Eigenschaft P18) bzw. `wikimedia_commons` auf und prüft die Lizenz; die App zeigt nur
// Bilder mit freier Lizenz und nennt immer Urheber, Lizenz und Quelle. Rein, ohne Netz (Pipeline und App teilen sie).
import { z } from 'zod';

/** Verweise aus OSM-Tags auf ein Foto (je Gewässer-ID) */
export interface PhotoRef {
  /** Wikidata-Objekt (Q123) */
  wd?: string | undefined;
  /** Dateiname auf Commons (mit Unterstrichen, ohne „File:“) */
  wc?: string | undefined;
}

/** Ein aufgelöstes Foto samt Namensnennung */
export const WaterPhotoSchema = z.object({
  /** Dateiname auf Commons (Unterstriche) */
  f: z.string().min(1),
  /** Pfadteil der Vorschau-Adresse („a/a9“, aus dem MD5 des Dateinamens) */
  h: z.string().regex(/^[0-9a-f]\/[0-9a-f]{2}$/),
  /** Urheber (Text) */
  a: z.string(),
  /** Lizenz (Kurzname, z. B. „CC BY-SA 4.0“) */
  l: z.string().min(1),
  /** Adresse des Lizenztexts */
  lu: z.string().optional(),
  /** Seite der Datei auf Commons (Beschreibung, Urheber, Lizenz) */
  p: z.string().min(1),
});
export type WaterPhoto = z.infer<typeof WaterPhotoSchema>;

export const PhotosFileSchema = z.object({
  format: z.literal('fangpunkt-photos'),
  formatVersion: z.literal(1),
  generatedAt: z.string(),
  source: z.string(),
  items: z.record(z.string(), WaterPhotoSchema),
});
export type PhotosFile = z.infer<typeof PhotosFileSchema>;

/** Vorschau-Breiten, die Wikimedia ausliefert (andere Breiten werden abgelehnt) */
export const THUMB_WIDTHS = [250, 500] as const;

const enc = (f: string) => encodeURIComponent(f.replace(/ /g, '_')).replace(/%28/g, '(').replace(/%29/g, ')');

/** Adresse der Vorschau auf upload.wikimedia.org (nur dieser Host, keine Weiterleitung) */
export function thumbUrl(p: Pick<WaterPhoto, 'f' | 'h'>, width: (typeof THUMB_WIDTHS)[number]): string {
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${p.h}/${enc(p.f)}/${width}px-${enc(p.f)}`;
}

/** „Foto: Urheber · Lizenz · Wikimedia Commons“ */
export function attribution(p: Pick<WaterPhoto, 'a' | 'l'>): string {
  return [p.a, p.l, 'Wikimedia Commons'].filter(Boolean).join(' · ');
}

/** Dateiname aus einem OSM-Tag `wikimedia_commons`: nur „File:…“ mit jpg/jpeg/png; Kategorien und alles andere → nichts */
export function fileFromCommonsTag(tag: string | undefined): string | undefined {
  const m = /^\s*File:(.+?)\s*$/i.exec(tag ?? '');
  if (!m?.[1]) return undefined;
  return toFileName(m[1]);
}

/** Dateiname mit Unterstrichen; nur Formate, die als Vorschau taugen (jpg, jpeg, png) */
export function toFileName(name: string): string | undefined {
  const f = name.trim().replace(/\s+/g, '_');
  return /\.(jpe?g|png)$/i.test(f) ? f : undefined;
}

/** Wikidata-Objekt aus dem OSM-Tag prüfen (Q123) */
export function wikidataId(tag: string | undefined): string | undefined {
  const m = /^\s*(Q\d{1,12})\s*$/i.exec(tag ?? '');
  return m?.[1]?.toUpperCase();
}

interface Claim {
  rank?: string;
  mainsnak?: { datavalue?: { value?: unknown } };
}

/** Bild (P18) eines Wikidata-Objekts: bevorzugter Rang, sonst der erste normale; Dateiname mit Unterstrichen */
export function imageOfEntity(entity: { claims?: { P18?: Claim[] } } | undefined): string | undefined {
  const claims = entity?.claims?.P18 ?? [];
  const ok = claims.filter(
    (c) => c.rank !== 'deprecated' && typeof c.mainsnak?.datavalue?.value === 'string',
  );
  const pick = ok.find((c) => c.rank === 'preferred') ?? ok[0];
  const v = pick?.mainsnak?.datavalue?.value;
  return typeof v === 'string' ? toFileName(v) : undefined;
}

/** Freie Lizenzen: CC0, CC BY, CC BY-SA, gemeinfrei. Alles andere (auch „NC“/„ND“, unbekannt) → nicht übernehmen. */
export function isFreeLicense(short: string | undefined): boolean {
  const s = (short ?? '').trim();
  if (!s || /\b(NC|ND)\b/i.test(s)) return false;
  return /^(CC0|CC[ -]BY(-SA)?\b|Public domain\b|PD\b|PD-)/i.test(s);
}

/** Urheber-Feld von Commons (enthält HTML) zu schlichtem Text */
export function plainText(html: string | undefined, max = 100): string {
  const t = (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export interface CommonsInfo {
  file: string;
  author: string;
  license: string;
  licenseUrl?: string | undefined;
  pageUrl: string;
}

interface CommonsPage {
  title?: string;
  missing?: boolean;
  imageinfo?: { descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[];
}

/** Seite der Commons-API (imageinfo mit extmetadata) → Angaben; nichts bei fehlender Datei, nichtfreier oder unklarer Lizenz */
export function commonsInfo(page: CommonsPage): CommonsInfo | undefined {
  if (page.missing || !page.title) return undefined;
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = plainText(meta['LicenseShortName']?.value, 40);
  if (!isFreeLicense(license)) return undefined;
  if (/^(true|1|yes)$/i.test(meta['NonFree']?.value ?? '')) return undefined;
  const pageUrl = info?.descriptionurl;
  if (!pageUrl || !/^https:\/\/commons\.wikimedia\.org\//.test(pageUrl)) return undefined;
  const file = toFileName(page.title.replace(/^File:/i, ''));
  if (!file) return undefined;
  const lu = meta['LicenseUrl']?.value;
  return {
    file,
    author: plainText(meta['Artist']?.value) || plainText(meta['Credit']?.value),
    license,
    ...(lu && /^https?:\/\//.test(lu) ? { licenseUrl: lu } : {}),
    pageUrl,
  };
}

/**
 * Fotos je Gewässer zusammenstellen: Datei aus dem Commons-Tag, sonst das Bild des Wikidata-Objekts; nur wenn die
 * Lizenz geprüft frei ist. `hash` liefert den Pfadteil der Vorschau-Adresse (MD5 des Dateinamens).
 */
export function buildPhotos(
  refs: Record<string, PhotoRef>,
  wikidataImages: ReadonlyMap<string, string>,
  commons: ReadonlyMap<string, CommonsInfo>,
  hash: (file: string) => string,
): Record<string, WaterPhoto> {
  const out: Record<string, WaterPhoto> = {};
  for (const [wid, ref] of Object.entries(refs)) {
    const file = ref.wc ?? (ref.wd ? wikidataImages.get(ref.wd) : undefined);
    const info = file ? commons.get(file) : undefined;
    if (!file || !info) continue;
    out[wid] = {
      f: info.file,
      h: hash(info.file),
      a: info.author,
      l: info.license,
      ...(info.licenseUrl ? { lu: info.licenseUrl } : {}),
      p: info.pageUrl,
    };
  }
  return out;
}

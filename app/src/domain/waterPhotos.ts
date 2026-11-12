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
  /** Commons-Kategorie (ohne „Category:“, mit Unterstrichen) */
  cat?: string | undefined;
  /** Wikipedia-Artikel aus dem OSM-Tag `wikipedia`, z. B. „de:Möhnesee“ */
  wp?: string | undefined;
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
  /** Landeswappen je Bundesland-Kürzel (SVG auf Commons, als PNG-Vorschau); fehlt = kein Wappen */
  crests: z.record(z.string(), WaterPhotoSchema).optional(),
});
export type PhotosFile = z.infer<typeof PhotosFileSchema>;

/** Vorschau-Breiten, die Wikimedia ausliefert (andere Breiten werden abgelehnt) */
export const THUMB_WIDTHS = [250, 500, 960] as const;

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

/** Dateiname mit Unterstrichen; nur Formate, die als Vorschau taugen (jpg, jpeg, png; für Wappen auch svg) */
export function toFileName(name: string, svg = false): string | undefined {
  const f = name.trim().replace(/\s+/g, '_');
  return (svg ? /\.(jpe?g|png|svg)$/i : /\.(jpe?g|png)$/i).test(f) ? f : undefined;
}

/** Kategorie aus einem OSM-Tag `wikimedia_commons=Category:…` (ohne Präfix, mit Unterstrichen) */
export function categoryFromCommonsTag(tag: string | undefined): string | undefined {
  const m = /^\s*Category:(.+?)\s*$/i.exec(tag ?? '');
  const c = m?.[1]?.replace(/\s+/g, '_');
  return c && !/[|\n]/.test(c) ? c : undefined;
}

/** Artikel aus einem OSM-Tag `wikipedia=de:Titel` (Sprache + Titel mit Unterstrichen; ohne Abschnitt) */
export function wikipediaFromTag(tag: string | undefined): { lang: string; title: string } | undefined {
  const m = /^\s*([a-z]{2,3}):(.+?)\s*$/i.exec(tag ?? '');
  const title = m?.[2]?.split('#')[0]?.trim().replace(/\s+/g, '_');
  const lang = m?.[1]?.toLowerCase();
  return lang && title && !/[|\n]/.test(title) ? { lang, title } : undefined;
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
export function imageOfEntity(
  entity: { claims?: Record<string, Claim[] | undefined> } | undefined,
  property: 'P18' | 'P94' = 'P18',
): string | undefined {
  const claims = entity?.claims?.[property] ?? [];
  const ok = claims.filter(
    (c) => c.rank !== 'deprecated' && typeof c.mainsnak?.datavalue?.value === 'string',
  );
  const pick = ok.find((c) => c.rank === 'preferred') ?? ok[0];
  const v = pick?.mainsnak?.datavalue?.value;
  return typeof v === 'string' ? toFileName(v, property === 'P94') : undefined;
}

/** Freie Lizenzen: CC0, CC BY, CC BY-SA, gemeinfrei. Alles andere (auch „NC“/„ND“, unbekannt) → nicht übernehmen. */
/** Commons-Kategorie (P373) eines Wikidata-Objekts */
export function categoryOfEntity(
  entity: { claims?: Record<string, Claim[] | undefined> } | undefined,
): string | undefined {
  const v = entity?.claims?.['P373']?.[0]?.mainsnak?.datavalue?.value;
  return typeof v === 'string' && !/[|\n]/.test(v) ? v.trim().replace(/\s+/g, '_') : undefined;
}

/** Titel des Artikels eines Wikidata-Objekts in einer Wikipedia-Sprache (`sitelinks.dewiki`) */
export function articleOfEntity(
  entity: { sitelinks?: Record<string, { title?: string } | undefined> } | undefined,
  lang: string,
): string | undefined {
  const t = entity?.sitelinks?.[`${lang}wiki`]?.title;
  return t && !/[|\n]/.test(t) ? t.trim().replace(/\s+/g, '_') : undefined;
}

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
  imageinfo?: {
    descriptionurl?: string;
    width?: number;
    height?: number;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

/** Dateinamen, die erkennbar kein Foto des Gewässers sind (Karten, Wappen, Logos, Pläne …) */
const NOT_A_PHOTO =
  /(^|[_\-.\s])(karte|map|maps|wappen|coat|logo|flagge|flag|diagram|diagramm|plan|lageplan|schild|sign|skizze|grafik|chart|gliederung|uebersicht|übersicht|lage|location|locator|verlauf|einzugsgebiet|querschnitt|schema|topographie|relief)([_\-.\s\d]|$)/i;
export const isPhotoName = (file: string): boolean => !NOT_A_PHOTO.test(file);

/**
 * Aus den Dateien einer Commons-Kategorie das Foto wählen: freie Lizenz, Querformat, mindestens 800 px breit, kein
 * Karten-/Wappen-Name; unter mehreren das mit der größten Breite (meist das sorgfältigste Foto). Nichts → nichts.
 */
export function pickFromCategory(pages: readonly CommonsPage[]): CommonsInfo | undefined {
  let best: { info: CommonsInfo; width: number } | undefined;
  for (const page of pages) {
    const info = commonsInfo(page);
    const size = page.imageinfo?.[0];
    const w = size?.width ?? 0;
    const h = size?.height ?? 0;
    if (!info || !isPhotoName(info.file) || w < 800 || w < h * 1.2) continue;
    if (!best || w > best.width) best = { info, width: w };
  }
  return best?.info;
}

/**
 * Pro Gewässer das erste Bild aus der Kandidatenliste, das eine geprüfte freie Lizenz hat (Reihenfolge = Güte:
 * Commons-Datei, Wikidata-Bild, Wikipedia-Artikelbild, Kategorie).
 */
export function choosePhotos(
  candidates: Readonly<Record<string, readonly string[]>>,
  commons: ReadonlyMap<string, CommonsInfo>,
  hash: (file: string) => string,
): Record<string, WaterPhoto> {
  const out: Record<string, WaterPhoto> = {};
  for (const [wid, files] of Object.entries(candidates)) {
    const info = files.map((f) => commons.get(f)).find((i): i is CommonsInfo => !!i);
    if (!info) continue;
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

/** Seite der Commons-API (imageinfo mit extmetadata) → Angaben; nichts bei fehlender Datei, nichtfreier oder unklarer Lizenz */
export function commonsInfo(page: CommonsPage, svg = false): CommonsInfo | undefined {
  if (page.missing || !page.title) return undefined;
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = plainText(meta['LicenseShortName']?.value, 40);
  if (!isFreeLicense(license)) return undefined;
  if (/^(true|1|yes)$/i.test(meta['NonFree']?.value ?? '')) return undefined;
  const pageUrl = info?.descriptionurl;
  if (!pageUrl || !/^https:\/\/commons\.wikimedia\.org\//.test(pageUrl)) return undefined;
  const file = toFileName(page.title.replace(/^File:/i, ''), svg);
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

/** Vorschau eines Wappens: SVG wird von Wikimedia als PNG der gewünschten Breite ausgeliefert */
export function crestUrl(c: Pick<WaterPhoto, 'f' | 'h'>, width: 120 | 250): string {
  const f = enc(c.f);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${c.h}/${f}/${width}px-${f}${/\.svg$/i.test(c.f) ? '.png' : ''}`;
}

/** Wikidata-Objekte der Bundesländer (Kürzel wie in `StateCode`). Die Pipeline prüft jedes gegen den ISO-Code (P300). */
export const STATE_ENTITIES: Readonly<Record<string, { q: string; iso: string }>> = {
  BW: { q: 'Q985', iso: 'DE-BW' },
  BY: { q: 'Q980', iso: 'DE-BY' },
  BE: { q: 'Q64', iso: 'DE-BE' },
  BB: { q: 'Q1208', iso: 'DE-BB' },
  HB: { q: 'Q1209', iso: 'DE-HB' },
  HH: { q: 'Q1055', iso: 'DE-HH' },
  HE: { q: 'Q1199', iso: 'DE-HE' },
  MV: { q: 'Q1196', iso: 'DE-MV' },
  NI: { q: 'Q1197', iso: 'DE-NI' },
  NW: { q: 'Q1198', iso: 'DE-NW' },
  RP: { q: 'Q1200', iso: 'DE-RP' },
  SL: { q: 'Q1201', iso: 'DE-SL' },
  SN: { q: 'Q1202', iso: 'DE-SN' },
  ST: { q: 'Q1206', iso: 'DE-ST' },
  SH: { q: 'Q1194', iso: 'DE-SH' },
  TH: { q: 'Q1205', iso: 'DE-TH' },
};

/** ISO-3166-2-Code (P300) eines Wikidata-Objekts – schützt vor falschen Objekt-IDs */
export function entityIso(
  entity: { claims?: Record<string, Claim[] | undefined> } | undefined,
): string | undefined {
  const v = entity?.claims?.['P300']?.[0]?.mainsnak?.datavalue?.value;
  return typeof v === 'string' ? v : undefined;
}

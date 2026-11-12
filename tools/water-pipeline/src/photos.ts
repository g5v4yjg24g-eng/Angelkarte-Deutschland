// Fotos zu Gewässern auflösen (Wunsch Nutzer 2026-11-11): liest photo-refs.json (aus process.ts), fragt Wikidata (Bild P18)
// und Wikimedia Commons (Urheber, Lizenz) in Stapeln ab und schreibt photos.json. Nur beim Bauen, nie zur Laufzeit der App.
// Nicht kritisch: schlägt der Abruf fehl, bleibt die Datei leer bzw. fehlt, und die App zeigt Platzhalter.
// Aufruf: node --import tsx src/photos.ts <ausgabeordner>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPhotos,
  commonsInfo,
  imageOfEntity,
  type CommonsInfo,
  type PhotoRef,
  type PhotosFile,
} from '../../../app/src/domain/waterPhotos.ts';

const UA = 'Fangpunkt-Gewaesserpipeline/1 (nicht kommerziell; https://github.com/g5v4yjg24g-eng/Angelkarte-Deutschland)';
const BATCH = 50;
const PAUSE_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET mit Wiederholung bei 429/5xx (Wartezeit wächst, Retry-After wird beachtet) */
async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url.slice(0, 80)}`);
    const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** attempt;
    await sleep(Math.min(wait, 60_000));
  }
  throw new Error(`zu viele Wiederholungen: ${url.slice(0, 80)}`);
}

const chunks = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const md5Path = (file: string) => {
  const h = createHash('md5').update(file).digest('hex');
  return `${h[0]}/${h.slice(0, 2)}`;
};

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error('Ausgabeordner fehlt');
  const refs = JSON.parse(readFileSync(join(outDir, 'photo-refs.json'), 'utf8')) as Record<string, PhotoRef>;

  // 1. Wikidata: Bild je Objekt (nur für Gewässer ohne Commons-Tag)
  const wdIds = [...new Set(Object.values(refs).filter((r) => !r.wc && r.wd).map((r) => r.wd as string))];
  const wdImages = new Map<string, string>();
  for (const ids of chunks(wdIds, BATCH)) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${ids.join('|')}`;
    const data = (await getJson(url)) as { entities?: Record<string, Parameters<typeof imageOfEntity>[0]> };
    for (const [id, e] of Object.entries(data.entities ?? {})) {
      const f = imageOfEntity(e);
      if (f) wdImages.set(id, f);
    }
    await sleep(PAUSE_MS);
  }

  // 2. Commons: Urheber und Lizenz je Datei
  const files = [...new Set([...Object.values(refs).flatMap((r) => (r.wc ? [r.wc] : [])), ...wdImages.values()])];
  const info = new Map<string, CommonsInfo>();
  for (const names of chunks(files, BATCH)) {
    const titles = names.map((f) => `File:${f}`).join('|');
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo' +
      '&iiprop=extmetadata%7Curl&iiextmetadatafilter=Artist%7CCredit%7CLicenseShortName%7CLicenseUrl%7CNonFree' +
      `&titles=${encodeURIComponent(titles)}`;
    const data = (await getJson(url)) as { query?: { pages?: Parameters<typeof commonsInfo>[0][] } };
    for (const page of data.query?.pages ?? []) {
      const i = commonsInfo(page);
      if (i) info.set(i.file, i);
    }
    await sleep(PAUSE_MS);
  }

  const items = buildPhotos(refs, wdImages, info, md5Path);
  const file: PhotosFile = {
    format: 'fangpunkt-photos',
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'Wikimedia Commons (Wikidata P18 / OSM wikimedia_commons), nur freie Lizenzen',
    items,
  };
  writeFileSync(join(outDir, 'photos.json'), JSON.stringify(file));
  // Manifest verweist erst jetzt auf die Datei: ohne Fotos bleibt es unverändert
  const mPath = join(outDir, 'water-manifest.json');
  const manifest = JSON.parse(readFileSync(mPath, 'utf8')) as Record<string, unknown>;
  writeFileSync(mPath, JSON.stringify({ ...manifest, photos: 'photos.json' }, null, 2));
  console.log(`  ${Object.keys(refs).length} Verweise, ${wdIds.length} Wikidata-Objekte, ${files.length} Dateien → ${Object.keys(items).length} Fotos`);
}

main().catch((e) => {
  // Fotos sind Beiwerk: ohne sie läuft die App mit Platzhaltern weiter
  console.error(`WARNUNG: Fotos nicht erzeugt (${e instanceof Error ? e.message : e})`);
});

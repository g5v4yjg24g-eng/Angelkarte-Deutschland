// Fotos zu Gewässern auflösen (Wunsch Nutzer 2026-11-11): liest photo-refs.json (aus process.ts), fragt Wikidata (Bild P18)
// und Wikimedia Commons (Urheber, Lizenz) in Stapeln ab und schreibt photos.json. Nur beim Bauen, nie zur Laufzeit der App.
// Nicht kritisch: schlägt der Abruf fehl, bleibt die Datei leer bzw. fehlt, und die App zeigt Platzhalter.
// Aufruf: node --import tsx src/photos.ts <ausgabeordner>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  articleOfEntity,
  categoryOfEntity,
  choosePhotos,
  isPhotoName,
  pickFromCategory,
  toFileName,
  wikipediaFromTag,
  commonsInfo,
  entityIso,
  STATE_ENTITIES,
  type WaterPhoto,
  imageOfEntity,
  type CommonsInfo,
  type PhotoRef,
  type PhotosFile,
} from "../../../app/src/domain/waterPhotos.ts";

const UA =
  "Fangpunkt-Gewaesserpipeline/1 (nicht kommerziell; https://github.com/g5v4yjg24g-eng/Angelkarte-Deutschland)";
const BATCH = 50;
const PAUSE_MS = 300;
/** Höchstdauer für die Kategorie-Abfragen (eine je Kategorie) */
const CATEGORY_BUDGET_MS = 45 * 60_000;

type WikidataEntity = Parameters<typeof imageOfEntity>[0] &
  Parameters<typeof articleOfEntity>[0];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET mit Wiederholung bei 429/5xx (Wartezeit wächst, Retry-After wird beachtet) */
async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500)
      throw new Error(`${res.status} ${url.slice(0, 80)}`);
    const wait =
      Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
    await sleep(Math.min(wait, 60_000));
  }
  throw new Error(`zu viele Wiederholungen: ${url.slice(0, 80)}`);
}

const chunks = <T>(xs: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
    xs.slice(i * n, i * n + n),
  );
const md5Path = (file: string) => {
  const h = createHash("md5").update(file).digest("hex");
  return `${h[0]}/${h.slice(0, 2)}`;
};

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("Ausgabeordner fehlt");
  const refs = JSON.parse(
    readFileSync(join(outDir, "photo-refs.json"), "utf8"),
  ) as Record<string, PhotoRef>;

  // Kandidaten je Gewässer, in Reihenfolge der Güte: Commons-Datei, Wikidata-Bild, Wikipedia-Artikelbild, Kategorie.
  const candidates: Record<string, string[]> = {};
  const addCandidate = (wid: string, file: string | undefined) => {
    if (!file) return;
    const list = (candidates[wid] ??= []);
    if (!list.includes(file)) list.push(file);
  };
  const categories = new Map<string, string>();
  const articles = new Map<string, { lang: string; title: string }>();
  for (const [wid, r] of Object.entries(refs)) {
    addCandidate(wid, r.wc);
    if (r.cat) categories.set(wid, r.cat);
    const art = wikipediaFromTag(r.wp);
    if (art) articles.set(wid, art);
  }
  // Teilschritte dürfen scheitern: was bis dahin gefunden ist, bleibt erhalten
  const guard = async (what: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      console.error(
        `  ${what} unvollständig (${e instanceof Error ? e.message : e})`,
      );
    }
  };

  // 1. Wikidata: Bild (P18), Commons-Kategorie (P373) und Artikel je Objekt
  await guard("Wikidata", async () => {
    const wdIds = [
      ...new Set(Object.values(refs).flatMap((r) => (r.wd ? [r.wd] : []))),
    ];
    const widsOf = new Map<string, string[]>();
    for (const [wid, r] of Object.entries(refs))
      if (r.wd) widsOf.set(r.wd, [...(widsOf.get(r.wd) ?? []), wid]);
    for (const ids of chunks(wdIds, BATCH)) {
      const url =
        `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims%7Csitelinks` +
        `&sitefilter=dewiki%7Cenwiki&ids=${ids.join("|")}`;
      const data = (await getJson(url)) as {
        entities?: Record<string, WikidataEntity>;
      };
      for (const [id, e] of Object.entries(data.entities ?? {})) {
        const image = imageOfEntity(e);
        const cat = categoryOfEntity(e);
        const de = articleOfEntity(e, "de");
        const en = articleOfEntity(e, "en");
        for (const wid of widsOf.get(id) ?? []) {
          addCandidate(wid, image);
          if (cat && !categories.has(wid)) categories.set(wid, cat);
          if (!articles.has(wid)) {
            if (de) articles.set(wid, { lang: "de", title: de });
            else if (en) articles.set(wid, { lang: "en", title: en });
          }
        }
      }
      await sleep(PAUSE_MS);
    }
  });

  // 2. Wikipedia: Artikelbild (nur für Gewässer ohne eigenes Bild-Kandidaten, damit es bei der Güte bleibt)
  let fromArticle = 0;
  await guard("Wikipedia", async () => {
    const byLang = new Map<string, Map<string, string[]>>();
    for (const [wid, { lang, title }] of articles) {
      const perTitle = byLang.get(lang) ?? new Map<string, string[]>();
      perTitle.set(title, [...(perTitle.get(title) ?? []), wid]);
      byLang.set(lang, perTitle);
    }
    for (const [lang, perTitle] of byLang) {
      for (const titles of chunks([...perTitle.keys()], BATCH)) {
        const url =
          `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages` +
          `&piprop=name&redirects=1&titles=${encodeURIComponent(titles.map((t) => t.replace(/_/g, " ")).join("|"))}`;
        const data = (await getJson(url)) as {
          query?: {
            normalized?: { from: string; to: string }[];
            redirects?: { from: string; to: string }[];
            pages?: { title?: string; pageimage?: string }[];
          };
        };
        const q = data.query ?? {};
        const image = new Map(
          (q.pages ?? []).map((p) => [
            p.title ?? "",
            p.pageimage ? toFileName(p.pageimage) : undefined,
          ]),
        );
        const hop = (m?: { from: string; to: string }[]) =>
          new Map((m ?? []).map((x) => [x.from, x.to]));
        const norm = hop(q.normalized);
        const redir = hop(q.redirects);
        for (const t of titles) {
          const asked = t.replace(/_/g, " ");
          const n = norm.get(asked) ?? asked;
          const file = image.get(redir.get(n) ?? n);
          // Artikelbilder sind oft Karten oder Schaubilder: nur Fotos (jpg) ohne Karten-Namen
          if (!file || !/\.jpe?g$/i.test(file) || !isPhotoName(file)) continue;
          for (const wid of perTitle.get(t) ?? []) {
            if (!candidates[wid]?.length) fromArticle++;
            addCandidate(wid, file);
          }
        }
        await sleep(PAUSE_MS);
      }
    }
  });

  // 3. Commons: Urheber und Lizenz je Datei
  const info = new Map<string, CommonsInfo>();
  const lookup = async (files: string[]) => {
    for (const names of chunks(files, BATCH)) {
      const titles = names.map((f) => `File:${f}`).join("|");
      const url =
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo" +
        "&iiprop=extmetadata%7Curl&iiextmetadatafilter=Artist%7CCredit%7CLicenseShortName%7CLicenseUrl%7CNonFree" +
        `&titles=${encodeURIComponent(titles)}`;
      const data = (await getJson(url)) as {
        query?: { pages?: Parameters<typeof commonsInfo>[0][] };
      };
      for (const page of data.query?.pages ?? []) {
        const i = commonsInfo(page);
        if (i) info.set(i.file, i);
      }
      await sleep(PAUSE_MS);
    }
  };
  await guard("Commons-Lizenzen", () =>
    lookup([...new Set(Object.values(candidates).flat())]),
  );
  const direct = Object.keys(choosePhotos(candidates, info, md5Path)).length;

  // 4. Commons-Kategorien: für Gewässer ohne geprüftes Foto ein freies Querformat-Foto aus der Kategorie wählen
  let fromCategory = 0;
  await guard("Commons-Kategorien", async () => {
    const have = new Set(Object.keys(choosePhotos(candidates, info, md5Path)));
    const wanted = new Map<string, string[]>();
    for (const [wid, cat] of categories)
      if (!have.has(wid)) wanted.set(cat, [...(wanted.get(cat) ?? []), wid]);
    const started = Date.now();
    for (const [cat, wids] of wanted) {
      if (Date.now() - started > CATEGORY_BUDGET_MS) {
        console.error("  Kategorien: Zeitgrenze erreicht, Rest übersprungen");
        break;
      }
      const url =
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&generator=categorymembers" +
        `&gcmtitle=${encodeURIComponent(`Category:${cat.replace(/_/g, " ")}`)}&gcmtype=file&gcmlimit=30&prop=imageinfo` +
        "&iiprop=extmetadata%7Curl%7Csize&iiextmetadatafilter=Artist%7CCredit%7CLicenseShortName%7CLicenseUrl%7CNonFree";
      const data = (await getJson(url)) as {
        query?: { pages?: Parameters<typeof pickFromCategory>[0][number][] };
      };
      const pick = pickFromCategory(data.query?.pages ?? []);
      if (pick) {
        info.set(pick.file, pick);
        for (const wid of wids) addCandidate(wid, pick.file);
        fromCategory += wids.length;
      }
      await sleep(PAUSE_MS);
    }
  });

  const items = choosePhotos(candidates, info, md5Path);
  console.log(
    `  Quellen: ${direct} über Commons/Wikidata, ${fromArticle} Artikelbilder versucht, ${fromCategory} über Kategorien`,
  );

  // 3. Landeswappen (Wikidata P94, Objekt gegen den ISO-Code geprüft, nur freie Lizenz)
  const crests: Record<string, WaterPhoto> = {};
  try {
    const states = Object.entries(STATE_ENTITIES);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${states.map(([, v]) => v.q).join("|")}`;
    const data = (await getJson(url)) as {
      entities?: Record<string, Parameters<typeof imageOfEntity>[0]>;
    };
    const files = new Map<string, string>();
    for (const [code, { q, iso }] of states) {
      const e = data.entities?.[q];
      if (entityIso(e) !== iso) {
        console.error(
          `  Wappen ${code}: Objekt ${q} hat nicht den Code ${iso}, übersprungen`,
        );
        continue;
      }
      const f = imageOfEntity(e, "P94");
      if (f) files.set(code, f);
      else console.error(`  Wappen ${code}: kein Bild (P94)`);
    }
    const titles = [...new Set(files.values())]
      .map((f) => `File:${f}`)
      .join("|");
    const cUrl =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo" +
      "&iiprop=extmetadata%7Curl&iiextmetadatafilter=Artist%7CCredit%7CLicenseShortName%7CLicenseUrl%7CNonFree" +
      `&titles=${encodeURIComponent(titles)}`;
    const cData = (await getJson(cUrl)) as {
      query?: { pages?: Parameters<typeof commonsInfo>[0][] };
    };
    const byFile = new Map<string, CommonsInfo>();
    for (const page of cData.query?.pages ?? []) {
      const i = commonsInfo(page, true);
      if (i) byFile.set(i.file, i);
    }
    for (const [code, f] of files) {
      const i = byFile.get(f);
      if (!i) {
        console.error(
          `  Wappen ${code}: ${f} ohne freie Lizenz oder nicht gefunden, übersprungen`,
        );
        continue;
      }
      crests[code] = {
        f: i.file,
        h: md5Path(i.file),
        a: i.author,
        l: i.license,
        ...(i.licenseUrl ? { lu: i.licenseUrl } : {}),
        p: i.pageUrl,
      };
    }
  } catch (e) {
    console.error(
      `  Wappen nicht erzeugt (${e instanceof Error ? e.message : e})`,
    );
  }
  const file: PhotosFile = {
    format: "fangpunkt-photos",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    source:
      "Wikimedia Commons (Wikidata P18 / OSM wikimedia_commons), nur freie Lizenzen",
    items,
    crests,
  };
  writeFileSync(join(outDir, "photos.json"), JSON.stringify(file));
  // Manifest verweist erst jetzt auf die Datei: ohne Fotos bleibt es unverändert
  const mPath = join(outDir, "water-manifest.json");
  const manifest = JSON.parse(readFileSync(mPath, "utf8")) as Record<
    string,
    unknown
  >;
  writeFileSync(
    mPath,
    JSON.stringify({ ...manifest, photos: "photos.json" }, null, 2),
  );
  console.log(
    `  ${Object.keys(refs).length} Verweise → ${Object.keys(items).length} Fotos (${fromArticle} Artikelbilder versucht, ${fromCategory} über Kategorien), ${Object.keys(crests).length} Wappen`,
  );
}

main().catch((e) => {
  // Fotos sind Beiwerk: ohne sie läuft die App mit Platzhaltern weiter
  console.error(
    `WARNUNG: Fotos nicht erzeugt (${e instanceof Error ? e.message : e})`,
  );
});

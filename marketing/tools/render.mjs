// Erzeugt Profilbilder, Markenbausteine und alle Social-Media-Motive.
// Der Fisch kommt unverändert aus dem Marken-Master der App (app/src/design/brand/fish.json über app/scripts/brand.mjs).
// Ablauf: HTML-Vorlagen nach marketing/templates/ schreiben → mit Chromium in exakter Pixelgröße als PNG rendern.
// Aufruf (Repo-Root): node marketing/tools/render.mjs
// Texte ändern: unten in MOTIFS bearbeiten und neu rendern (oder die HTML-Datei in templates/ direkt anpassen).
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';
import { fish, fishGroup } from '../../app/scripts/brand.mjs';

const root = new URL('../', import.meta.url).pathname;
const dir = (p) => (mkdirSync(root + p, { recursive: true }), root + p);
const C = {
  deep: fish.colors.deep, // #0B2A33
  fish: fish.colors.fish, // #E8F4F5
  eye: fish.colors.eye, // #F2994A
  ripple: fish.colors.ripple, // #5CC4D6
  primary: '#0F5C6E',
  bg: '#F3F6F6',
  text: '#0E2229',
  muted: '#4A5F66',
  night: '#0A181D',
};

// ---------- Fisch-Varianten (gleiche Geometrie, nur Farben getauscht) ----------
function fishSvg({ variant = 'dark', bg = true, size = 1080, scale = 0.8, dy = -1, ripple = true, round = false } = {}) {
  let g = fishGroup({ scale, dy, withRipple: ripple });
  let bgFill = C.deep;
  if (variant === 'light') {
    // Heller Grund: Fisch dunkel, Kiemenlinie hell, Welle im Primärton
    g = g
      .replaceAll(`fill="${C.fish}"`, 'fill="__FISH__"')
      .replaceAll(`stroke="${C.deep}"`, `stroke="${C.fish}"`)
      .replaceAll('fill="__FISH__"', `fill="${C.deep}"`)
      .replaceAll(`stroke="${C.ripple}"`, `stroke="${C.primary}"`);
    bgFill = C.fish;
  }
  const back = bg
    ? round
      ? `<circle cx="50" cy="50" r="50" fill="${bgFill}"/>`
      : `<rect width="100" height="100" fill="${bgFill}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${back}${g}</svg>`;
}

/** Profilbild mit leichtem Tiefenverlauf und Wasserring – bleibt rund zugeschnitten und bei 40 px erkennbar. */
function profileSvg({ variant = 'dark', size = 1080 } = {}) {
  const dark = variant === 'dark';
  const g = fishSvg({ variant, bg: false, scale: 0.84, dy: -3 }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const grad = dark
    ? `<radialGradient id="d" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#11414E"/><stop offset="1" stop-color="${C.deep}"/></radialGradient>`
    : `<radialGradient id="d" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCEDEF"/></radialGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><defs>${grad}</defs><rect width="100" height="100" fill="url(#d)"/>${g}</svg>`;
}

// ---------- Gemeinsames CSS ----------
const css = `
@font-face{font-family:Inter;font-weight:100 900;src:url(../brand/fonts/inter-latin-wght-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+20AC,U+2212}
@font-face{font-family:Inter;font-weight:100 900;src:url(../brand/fonts/inter-latin-ext-wght-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+1E00-1E9F}
@font-face{font-family:Fraunces;font-weight:100 900;src:url(../brand/fonts/fraunces-latin-wght-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+20AC}
@font-face{font-family:Fraunces;font-weight:100 900;src:url(../brand/fonts/fraunces-latin-ext-wght-normal.woff2) format('woff2');unicode-range:U+0100-02BA,U+1E00-1E9F}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:var(--w);height:var(--h);overflow:hidden}
body{font-family:Inter,sans-serif;color:${C.fish};background:${C.deep};position:relative;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;background:radial-gradient(120% 80% at 80% 0%,#145A6A 0%,${C.deep} 55%,#071D24 100%)}
.bg.light{background:radial-gradient(120% 80% at 80% 0%,#FFFFFF 0%,${C.bg} 50%,#DCE9EB 100%)}
.waves{position:absolute;inset:0;opacity:.5}
.content{position:absolute;inset:0;padding:var(--pad);display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:18px;font:650 40px/1 Fraunces,serif;letter-spacing:.01em}
.brand svg{width:78px;height:78px}
.kicker{margin-top:56px;font:700 26px/1 Inter;letter-spacing:.14em;text-transform:uppercase;color:${C.ripple}}
.light .kicker,.kicker.l{color:${C.primary}}
h1{margin-top:22px;font:650 var(--h1)/1.04 Fraunces,serif;letter-spacing:-.01em;text-wrap:balance}
h1 em{font-style:normal;color:${C.eye}}
p.sub{margin-top:26px;font:400 var(--sub)/1.38 Inter;color:#BFD8DC;max-width:880px;text-wrap:pretty}
.light{color:${C.text}} .light p.sub{color:${C.muted}}
.phone{position:absolute;width:var(--pw);aspect-ratio:390/844;border-radius:calc(var(--pw)*.13);background:#05161B;padding:calc(var(--pw)*.035);box-shadow:0 40px 90px rgba(0,0,0,.45),0 0 0 2px rgba(92,196,214,.25)}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:calc(var(--pw)*.1);display:block}
.foot{margin-top:auto;display:flex;flex-wrap:wrap;gap:14px}
.pill{font:600 27px/1 Inter;padding:16px 24px;border-radius:999px;background:rgba(92,196,214,.14);border:1.5px solid rgba(92,196,214,.4);color:${C.fish}}
.light .pill{background:#fff;border-color:#CFDCDE;color:${C.text}}
.list{margin-top:44px;display:grid;gap:22px}
.item{display:flex;gap:24px;align-items:flex-start;font:500 36px/1.3 Inter}
.item .n{flex:none;width:58px;height:58px;border-radius:50%;background:${C.eye};color:#2B1600;font:800 28px/58px Inter;text-align:center}
.item small{display:block;font:400 28px/1.35 Inter;color:#9CC3CA;margin-top:6px}
.light .item small{color:${C.muted}}
.cta{display:inline-block;margin-top:40px;font:700 34px/1 Inter;padding:26px 40px;border-radius:999px;background:${C.eye};color:#2B1600;align-self:flex-start}
.note{font:400 28px/1.4 Inter;color:#9CC3CA}
.mark{position:absolute;right:-60px;bottom:40px;opacity:.09}
.light .note{color:${C.muted}}
.card{background:rgba(255,255,255,.06);border:1.5px solid rgba(92,196,214,.28);border-radius:28px;padding:30px 34px}
.light .card{background:#fff;border-color:#CFDCDE}
`;

const waves = (w, h, color = C.ripple, op = 0.35) => {
  const rows = [];
  for (let i = 0; i < 9; i++) {
    const y = h * (0.52 + i * 0.065);
    const amp = 10 + i * 3;
    const len = 120 + i * 16;
    let d = `M-20 ${y}`;
    for (let x = -20; x < w + len; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
    rows.push(`<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${op * (1 - i * 0.08)}" stroke-width="${2 + i * 0.25}" stroke-linecap="round"/>`);
  }
  return `<svg class="waves" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${rows.join('')}</svg>`;
};
const smallFish = (variant = 'dark') => fishSvg({ variant, bg: false, size: 78, scale: 1, dy: 0, ripple: false });

function page({ w, h, light = false, body }) {
  const story = h / w > 1.5;
  const vars = `--w:${w}px;--h:${h}px;--pad:${story ? '230px 84px 300px' : '76px 80px 72px'};--h1:${story ? 106 : 100}px;--sub:${story ? 40 : 37}px;--pw:${story ? 560 : 500}px`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head>
<body style="${vars}" class="${light ? 'light' : ''}"><div class="bg ${light ? 'light' : ''}"></div>${waves(w, h, light ? C.primary : C.ripple, light ? 0.18 : 0.35)}${body}</body></html>`;
}

const head = (m, light) =>
  `<div class="brand">${smallFish(light ? 'light' : 'dark')}Fangpunkt</div>
   ${m.kicker ? `<div class="kicker">${m.kicker}</div>` : ''}
   <h1>${m.title}</h1>
   ${m.sub ? `<p class="sub">${m.sub}</p>` : ''}`;

const shotPath = (name) => `../screenshots/${name}.png`;

// ---------- Layouts ----------
function layoutPhone(m, { w, h }) {
  const story = h / w > 1.5;
  const shots = m.shots;
  const pw = story ? 470 : shots.length === 1 ? 560 : 500;
  const ph = (pw * 844) / 390;
  let phones = '';
  if (shots.length === 1) {
    const top = story ? 900 : h - ph * 0.62;
    phones = `<div class="phone" style="--pw:${pw}px;left:${(w - pw) / 2}px;top:${top}px"><img src="${shotPath(shots[0])}"></div>`;
  } else {
    const p2 = pw * 0.9;
    const top = story ? 930 : h - ph * 0.6;
    phones = `<div class="phone" style="--pw:${p2}px;left:${w / 2 - p2 - 10}px;top:${top + 90}px;transform:rotate(-5deg)"><img src="${shotPath(shots[0])}"></div>
      <div class="phone" style="--pw:${p2}px;left:${w / 2 + 10}px;top:${top}px;transform:rotate(4deg)"><img src="${shotPath(shots[1])}"></div>`;
  }
  return `${phones}<div class="content" style="${story ? '' : 'padding-bottom:0'}">${head(m, m.light)}</div>`;
}

function layoutText(m, { w, h }) {
  const items = (m.items ?? [])
    .map((it, i) => `<div class="item"><span class="n">${m.numbered === false ? '✓' : i + 1}</span><div>${it[0]}${it[1] ? `<small>${it[1]}</small>` : ''}</div></div>`)
    .join('');
  const mark = `<div class="mark">${fishSvg({ bg: false, size: 520, scale: 1, dy: 0, ripple: false })}</div>`;
  return `${mark}<div class="content">${head(m, m.light)}
    ${items ? `<div class="list">${items}</div>` : ''}
    ${m.extra ?? ''}
    ${m.cta ? `<span class="cta">${m.cta}</span>` : ''}
    <div class="foot">${(m.pills ?? []).map((p) => `<span class="pill">${p}</span>`).join('')}</div>
    ${m.note ? `<p class="note" style="margin-top:22px">${m.note}</p>` : ''}</div>`;
}

const PILLS = ['Kostenlos', 'Ohne Konto', 'Daten bleiben auf dem Handy'];

// ---------- Die zehn Startmotive (Texte: marketing/posts/CAPTIONS.md) ----------
const MOTIFS = [
  {
    id: '01-launch', layout: 'phone', shots: ['light-karte'],
    kicker: 'Neu · Angel-App für ganz Deutschland',
    title: 'Gewässer finden. <em>Fänge</em> festhalten.',
    sub: 'Fangpunkt läuft im Browser und als App auf dem Startbildschirm – kostenlos, ohne Konto.',
  },
  {
    id: '02-app-uebersicht', layout: 'text',
    kicker: 'Was Fangpunkt kann',
    title: 'Fünf Dinge, die du am Wasser brauchst.',
    items: [
      ['Karte mit Gewässern in ganz Deutschland', 'Suche, Gewässerprofil, eigene Angelstellen'],
      ['Fangbuch', 'Fang, Fischkontakt, Fehlbiss – auch ohne Netz erfassbar'],
      ['Wetter, Pegel und Beißfenster', 'Vorhersage, amtliche Warnungen, Auswertung deiner Bisse'],
      ['Statistik', 'Arten, Köder, Fänge pro Stunde – mit ehrlichen Mindestmengen'],
      ['Angelrecht der Länder', 'Schonzeiten und Mindestmaße mit Quelle · keine Rechtsauskunft'],
    ],
    pills: PILLS,
  },
  {
    id: '03-tiefenkarten', layout: 'text',
    kicker: 'Ehrlich gesagt',
    title: 'Tiefenkarten? <em>Noch nicht.</em>',
    sub: 'Tiefendaten gibt es nur mit Erlaubnis der Rechteinhaber. Solange die fehlt, zeigt Fangpunkt keine – statt geschätzte Linien als Messung auszugeben.',
    items: [
      ['Was es heute gibt', 'Gewässerprofil mit Name, Typ, Fläche, Lage und Datenquelle'],
      ['Was kommt', 'Tiefenkarten erst mit geklärter Lizenz – und dann nur dort, wo echte Daten vorliegen'],
      ['Deine Hilfe', 'Du kennst eine Quelle mit freier Lizenz? Schreib uns.'],
    ],
    note: 'Planungshilfe heute: eigene Angelstellen, Kanten-Notizen und Fänge auf der Karte.',
  },
  {
    id: '04-fangbuch', layout: 'phone', shots: ['light-fangbuch', 'light-fang-detail'],
    kicker: 'Digitales Fangbuch',
    title: 'Jeder Biss zählt. Auch der <em>verlorene</em>.',
    sub: 'Fang, Fischkontakt, Fehlbiss oder Beobachtung – mit Köder, Methode, Foto und Wetter.',
  },
  {
    id: '05-wetter-beissfenster', layout: 'phone', shots: ['light-wetter', 'light-wetter-bisse'],
    kicker: 'Wetter & Beißfenster',
    title: 'Wann beißt es <em>bei dir</em>?',
    sub: 'Vorhersage und Luftdruck fürs Gewässer – und ab 20 Bissen deine eigene Auswertung nach Tageszeit.',
  },
  {
    id: '06-statistik', layout: 'phone', shots: ['light-statistik'],
    kicker: 'Statistik',
    title: 'Was wirklich <em>fängt</em>.',
    sub: 'Fänge pro Angelstunde, Köder, Arten, Verlauf – mit Stichprobengröße statt Bauchgefühl.',
  },
  {
    id: '07-angelstellen', layout: 'phone', shots: ['light-karte-heatmap'],
    kicker: 'Angelstellen & Heatmap',
    title: 'Deine Stellen. Nur auf <em>deinem</em> Handy.',
    sub: 'Angelstelle, Steg, Parkplatz per Tipp auf die Karte – nichts davon wird hochgeladen.',
  },
  {
    id: '08-entwicklung', layout: 'text',
    kicker: 'Hinter den Kulissen',
    title: 'Diese Woche neu in Fangpunkt',
    items: [
      ['Pegel am Fang', 'Wasserstand am nächsten Pegel wird zum Fang gespeichert'],
      ['Amtliche Unwetterwarnungen', 'vom Deutschen Wetterdienst, auch bei geplanten Angelterminen'],
      ['Angeltermine in den Handy-Kalender', 'als Kalenderdatei exportieren'],
      ['Karte merkt sich die Ansicht', 'zurück zum Standort mit einem Knopf'],
    ],
    numbered: false,
    note: 'Gebaut nebenbei, Schritt für Schritt. Was fehlt dir? Schreib’s in die Kommentare.',
  },
  {
    id: '09-community-frage', layout: 'text',
    kicker: 'Frage an euch',
    title: 'Morgens oder abends – wann läuft’s bei dir <em>besser</em>?',
    extra: `<div style="margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:28px">
      <div class="card" style="text-align:center"><div style="font:650 110px/1 Fraunces">A</div><div style="font:600 38px/1.2 Inter;margin-top:14px">Morgens</div><div class="note" style="margin-top:10px">vor 9 Uhr</div></div>
      <div class="card" style="text-align:center"><div style="font:650 110px/1 Fraunces">B</div><div style="font:600 38px/1.2 Inter;margin-top:14px">Abends</div><div class="note" style="margin-top:10px">ab 18 Uhr</div></div></div>`,
    note: 'Antwort in die Kommentare – mit Zielfisch und Gewässertyp (See, Fluss, Kanal).',
  },
  {
    id: '10-ausprobieren', layout: 'text',
    kicker: 'In 30 Sekunden startklar',
    title: 'Probier Fangpunkt aus.',
    items: [
      ['Link in der Bio öffnen', 'läuft direkt im Browser'],
      ['Zum Startbildschirm hinzufügen', 'iPhone: Teilen → „Zum Home-Bildschirm“ · Android: Menü → „App installieren“'],
      ['Ersten Fang eintragen', 'kein Konto, keine Anmeldung'],
    ],
    pills: PILLS,
    note: 'Nicht kommerziell · keine Werbung · noch in Entwicklung – Feedback willkommen.',
  },
];

// Karussell zu Motiv 2: je Funktion eine Seite mit echtem Screenshot
const CAROUSEL = [
  { id: '02-app-uebersicht-k1', layout: 'text', kicker: 'Wisch dich durch →', title: 'Fangpunkt in fünf Bildern', sub: 'Eine Angel-App für ganz Deutschland. Kostenlos, ohne Konto, deine Daten bleiben auf dem Handy.', pills: PILLS },
  { id: '02-app-uebersicht-k2', layout: 'phone', shots: ['light-karte'], kicker: '1 · Karte', title: 'Gewässer in ganz Deutschland', sub: 'Suchen, antippen, Profil mit Quelle ansehen.' },
  { id: '02-app-uebersicht-k3', layout: 'phone', shots: ['light-fangbuch-gewaesser'], kicker: '2 · Fangbuch', title: 'Fänge nach Gewässern', sub: 'Auch ohne Netz erfassen.' },
  { id: '02-app-uebersicht-k4', layout: 'phone', shots: ['light-wetter-luftdruck'], kicker: '3 · Wetter', title: 'Vorhersage und Luftdruck', sub: 'Plus amtliche Warnungen und Pegel.' },
  { id: '02-app-uebersicht-k5', layout: 'phone', shots: ['light-statistik'], kicker: '4 · Statistik', title: 'Ehrliche Zahlen', sub: 'Mit Stichprobengröße und Mindestmengen.' },
  { id: '02-app-uebersicht-k6', layout: 'phone', shots: ['light-recht'], kicker: '5 · Angelrecht', title: 'Schonzeiten und Mindestmaße', sub: 'Mit Paragraf und Quelle. Keine Rechtsauskunft.' },
];

const FEED = { w: 1080, h: 1350 };
const FEED34 = { w: 1080, h: 1440 };
const STORY = { w: 1080, h: 1920 };

function build(m, size) {
  const body = m.layout === 'phone' ? layoutPhone(m, size) : layoutText(m, size);
  return page({ ...size, light: m.light, body });
}

// ---------- Rendern ----------
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
async function render(html, htmlPath, pngPath, w, h, transparent = false) {
  writeFileSync(htmlPath, html);
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto('file://' + htmlPath);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  await p.screenshot({ path: pngPath, omitBackground: transparent });
  await p.close();
}
const svgPage = (svg, w, h, bg = 'transparent') =>
  `<!doctype html><html><body style="margin:0;background:${bg};width:${w}px;height:${h}px">${svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`)}</body></html>`;

const T = dir('templates/');
const tmp = dir('templates/_svg/');

// Profil und Marke
const prof = dir('profile/');
const brand = dir('brand/');
for (const v of ['dark', 'light']) {
  writeFileSync(`${prof}profilbild-${v}.svg`, profileSvg({ variant: v }));
  for (const s of [1080, 400]) await render(svgPage(profileSvg({ variant: v }), s, s), `${tmp}p.html`, `${prof}profilbild-${v}-${s}.png`, s, s);
  writeFileSync(`${brand}fisch-freigestellt-${v === 'dark' ? 'hell' : 'dunkel'}.svg`, fishSvg({ variant: v, bg: false, scale: 1, dy: 0 }));
  await render(svgPage(fishSvg({ variant: v, bg: false, scale: 1, dy: 0 }), 1600, 1600), `${tmp}f.html`, `${brand}fisch-freigestellt-${v === 'dark' ? 'hell' : 'dunkel'}-1600.png`, 1600, 1600, true);
}
// YouTube-Kanalbanner (2560×1440, sichere Zone 1546×423 in der Mitte) und Facebook-Titelbild (1640×624 hochauflösend für 820×312)
const bannerBody = (w, h, fishFrac = 0.22, subFrac = 0.03) =>
  page({ w, h, body: `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:40px">
    ${fishSvg({ bg: false, size: Math.round(h * fishFrac), scale: 1, dy: 0 })}
    <div><div style="font:650 ${Math.round(h * 0.11)}px/1 Fraunces">Fangpunkt</div>
    <div style="font:500 ${Math.round(h * subFrac)}px/1.3 Inter;color:#BFD8DC;margin-top:14px;white-space:nowrap">Gewässer finden · Fänge festhalten · ganz Deutschland</div></div></div>` });
await render(bannerBody(2560, 1440), `${T}banner-youtube.html`, `${brand}banner-youtube-2560x1440.png`, 2560, 1440);
await render(bannerBody(1640, 624, 0.36, 0.045), `${T}banner-facebook.html`, `${brand}banner-facebook-1640x624.png`, 1640, 624);

// Prüfbogen: Profilbild in Kreisausschnitt und Kleinstgrößen
const sizes = [180, 110, 64, 40, 32];
const sheet = `<!doctype html><html><body style="margin:0;padding:40px;font:16px Inter,sans-serif;background:#fff;display:grid;gap:30px">
${['dark', 'light'].map((v) => `<div style="display:flex;align-items:center;gap:28px">${sizes.map((s) => `<img src="../profile/profilbild-${v}-400.png" style="width:${s}px;height:${s}px;border-radius:50%">`).join('')}
<div style="background:#000;padding:20px;border-radius:16px;display:flex;gap:20px">${sizes.slice(2).map((s) => `<img src="../profile/profilbild-${v}-400.png" style="width:${s}px;height:${s}px;border-radius:50%">`).join('')}</div></div>`).join('')}
</body></html>`;
await render(sheet, `${T}profil-pruefbogen.html`, `${prof}pruefbogen-kleine-groessen.png`, 1000, 560);

// Motive
const posts = dir('posts/');
const stories = dir('stories/');
const carousel = dir('posts/02-karussell/');
for (const m of MOTIFS) {
  await render(build(m, FEED), `${T}${m.id}-feed.html`, `${posts}${m.id}-feed-1080x1350.png`, FEED.w, FEED.h);
  await render(build(m, FEED34), `${T}${m.id}-feed34.html`, `${posts}${m.id}-feed-1080x1440.png`, FEED34.w, FEED34.h);
  await render(build(m, STORY), `${T}${m.id}-story.html`, `${stories}${m.id}-story-1080x1920.png`, STORY.w, STORY.h);
  console.log('Motiv', m.id);
}
for (const m of CAROUSEL) {
  await render(build(m, FEED), `${T}${m.id}.html`, `${carousel}${m.id}-1080x1350.png`, FEED.w, FEED.h);
  // 3:4 passend zum Profilraster und zum Launch-Post (alle Bilder eines Karussells brauchen dasselbe Format)
  await render(build(m, FEED34), `${T}${m.id}-34.html`, `${carousel}${m.id}-1080x1440.png`, FEED34.w, FEED34.h);
  // 9:16-Fassung als Einzelbilder für das Slideshow-Reel (tools/reel.sh)
  await render(build(m, STORY), `${T}${m.id}-story.html`, `${dir('videos/_frames/')}${m.id}.png`, STORY.w, STORY.h);
}

// ---------- Reel-Titelbilder und Serien-Cover (9:16) ----------
// Text sitzt in der Mitte (y 420–1500), damit er im 3:4-Profilraster und im 4:5-Feed-Zuschnitt sichtbar bleibt.
function cover({ kicker, title, sub }) {
  return page({
    ...STORY,
    body: `<div style="position:absolute;left:84px;right:84px;top:50%;transform:translateY(-50%);text-align:center;display:flex;flex-direction:column;align-items:center">
      <span class="pill" style="font-size:30px">${kicker}</span>
      <h1 style="--h1:118px;margin-top:40px">${title}</h1>
      ${sub ? `<p class="sub" style="margin-top:30px;text-align:center">${sub}</p>` : ''}
    </div>
    <div class="brand" style="position:absolute;left:0;right:0;top:1500px;justify-content:center">${smallFish()}Fangpunkt</div>`,
  });
}
const COVERS = [
  ['video-v1', { kicker: 'Kurz erklärt', title: 'Fang eintragen, bevor er <em>zurück</em> im Wasser ist.' }],
  ['video-v2', { kicker: 'Problem am Wasser', title: 'Wo war nochmal die <em>Stelle</em>?' }],
  ['video-v3', { kicker: 'Fangbuch-Freitag', title: 'Mein Angeljahr – <em>ehrlich</em>.' }],
  ['video-v4', { kicker: 'Ehrlich gesagt', title: 'Keine Tiefenkarten. <em>Absichtlich.</em>' }],
  ['video-v5', { kicker: 'Kurz erklärt', title: 'Diese App gibt’s in <em>keinem</em> Store.' }],
  ['serie-beissfenster-check', { kicker: 'Beißfenster-Check', title: 'Angelwetter der <em>Woche</em>', sub: 'Vorhersage = Modellwert. Keine Garantie.' }],
  ['serie-wissen-30s', { kicker: 'Wissen in 30 Sekunden', title: 'Fänge pro <em>Stunde</em> statt pro Tag' }],
  ['serie-werkstatt-notiz', { kicker: 'Werkstatt-Notiz', title: 'Warum es Fangpunkt <em>gibt</em>' }],
  ['serie-frag-die-runde', { kicker: 'Frag die Runde', title: 'Morgens oder <em>abends</em>?' }],
  ['serie-euer-feedback', { kicker: 'Euer Feedback', title: 'Ihr habt gefragt – das <em>kommt</em>.' }],
];
const covers = dir('stories/reel-cover/');
for (const [id, c] of COVERS) {
  await render(cover(c), `${T}cover-${id}.html`, `${covers}cover-${id}-1080x1920.png`, STORY.w, STORY.h);
}
// Schluss-Karte für alle Videos (2 s am Ende)
await render(
  cover({ kicker: 'Kostenlos · ohne Konto', title: 'Link in der <em>Bio</em>', sub: 'Gewässer finden. Fänge festhalten.' }),
  `${T}schlusskarte.html`, `${brand}schlusskarte-1080x1920.png`, STORY.w, STORY.h,
);
await browser.close();

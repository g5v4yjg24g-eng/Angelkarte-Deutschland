// Erzeugt die HyperFrames-Kompositionen für die Steg-Clips (marketing/videos/clips-steg/<nr>-<name>.html).
// Jeder Clip: Aufnahme des Nutzers (assets/<name>.mp4, aus tools/clips-steg-prep.sh) + Kicker, Überschrift, Unterzeile
// + Schluss-Karte mit Fisch-Logo. Texte nennen nur Funktionen, die es in der App gibt.
// Aufruf (Repo-Root): node marketing/tools/clips-steg-build.mjs   → danach rendern (siehe videos/clips-steg/README.md)
import { mkdirSync, writeFileSync } from 'node:fs';

const dir = new URL('../videos/clips-steg/', import.meta.url).pathname;
const END = 2.6; // Länge der Schluss-Karte

const CLIPS = [
  {
    id: '01-ankommen', src: 'ankommen', len: 7, sound: true,
    kicker: 'Sessions', title: 'Ankommen. <em>Session</em> starten.', sub: 'Fangpunkt zählt deine echte Angelzeit.',
    t: [0.5, 2.2],
  },
  {
    id: '02-wurf', src: 'wurf', len: 11.2, sound: false,
    kicker: 'Angelstellen', title: 'Gute <em>Stelle</em>?', sub: 'Mit einem Tipp auf die Karte merken.',
    t: [0.5, 3.0],
  },
  {
    id: '03-pause', src: 'pause', len: 11, sound: true,
    kicker: 'Session-Pausen', title: 'Kurz <em>hinsetzen</em>.', sub: 'Pause drücken – zählt nicht als Angelzeit.',
    t: [0.6, 4.0],
  },
  {
    id: '04-schneidertag', src: 'zeitraffer', len: 7, sound: false,
    kicker: 'Ehrliche Statistik', title: 'Kein Biss? <em>Gehört dazu.</em>', sub: 'Fänge pro Angelstunde – auch Schneidertage zählen.',
    t: [0.4, 2.6], badge: '7 Minuten im Zeitraffer',
  },
  {
    id: '05-feierabend', src: 'feierabend', len: 7, sound: true,
    kicker: 'Session beenden', title: '<em>Feierabend.</em>', sub: 'Alles gespeichert – nur auf deinem Handy.',
    t: [0.5, 2.0],
  },
  {
    id: '06-sonntag-intro', src: 'sonntag', len: 5, sound: false, noEnd: true,
    kicker: 'Beißfenster-Check', title: 'Angelwetter der <em>Woche</em>', sub: 'Vorhersage = Modellwert. Keine Garantie.',
    t: [0.4, 1.6],
  },
];

const css = `
@font-face{font-family:'Inter';font-weight:100 900;src:url('assets/fonts/inter-latin-wght-normal.woff2') format('woff2')}
@font-face{font-family:'Fraunces';font-weight:100 900;src:url('assets/fonts/fraunces-latin-wght-normal.woff2') format('woff2')}
:root{--deep:#0b2a33;--fish:#e8f4f5;--eye:#f2994a;--ripple:#5cc4d6;--muted:#d6e8eb}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--deep)}
#root{position:relative;width:100%;height:100%;font-family:'Inter',sans-serif;color:var(--fish)}
.clip{position:absolute;inset:0}
#footage{width:1080px;height:1920px;object-fit:cover}
/* Verlauf oben, damit die Texte auf hellem Himmel lesbar bleiben */
#shade{background:linear-gradient(180deg,rgb(7 29 36 / .78) 0%,rgb(7 29 36 / .45) 26%,rgb(7 29 36 / 0) 46%)}
.kicker{top:250px;bottom:auto;left:84px;right:84px;font:700 30px/1 'Inter',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--ripple);opacity:0}
.title{top:300px;bottom:auto;left:84px;right:84px;font:650 104px/1.04 'Fraunces',serif;letter-spacing:-.01em;text-wrap:balance;opacity:0;text-shadow:0 4px 24px rgb(0 0 0 / .25)}
.title em,.end-title em{font-style:normal;color:var(--eye)}
.sub{top:auto;bottom:auto;left:84px;right:84px;font:500 44px/1.3 'Inter',sans-serif;color:var(--muted);text-wrap:balance;opacity:0;text-shadow:0 2px 16px rgb(0 0 0 / .35)}
.badge{top:auto;bottom:380px;left:0;right:0;display:flex;justify-content:center;opacity:0}
.badge span{font:600 30px/1 'Inter',sans-serif;padding:16px 26px;border-radius:999px;background:rgb(5 22 27 / .7);border:1.5px solid rgb(92 196 214 / .45)}
.end{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0;
  background:radial-gradient(120% 80% at 80% 0%,#145a6a 0%,var(--deep) 55%,#071d24 100%)}
.end img{width:300px;height:300px}
.end .brand{margin-top:6px;font:650 72px/1 'Fraunces',serif}
.end .end-title{margin-top:60px;font:650 104px/1.04 'Fraunces',serif}
.end .pill{margin-top:40px;font:600 34px/1 'Inter',sans-serif;padding:20px 32px;border-radius:999px;background:rgb(92 196 214 / .14);border:1.5px solid rgb(92 196 214 / .4)}
`;

function html(c) {
  const total = +(c.len + (c.noEnd ? 0 : END)).toFixed(2);
  const plain = c.title.replace(/<[^>]+>/g, '');
  const subTop = plain.length > 16 ? 550 : 440; // eine oder zwei Zeilen Überschrift
  const audio = c.sound ? `data-has-audio="true" data-volume="0.6" data-fade-in="0.3" data-fade-out="0.6"` : 'muted';
  return `<!doctype html>
<!-- Steg-Clip ${c.id} (erzeugt von marketing/tools/clips-steg-build.mjs – dort ändern). Aufnahme: assets/${c.src}.mp4 -->
<html lang="de" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${css}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
  <video id="footage" class="clip" src="assets/${c.src}.mp4" ${audio} data-start="0" data-duration="${c.len}" data-media-start="0" data-track-index="0"></video>
  <div id="shade" class="clip" data-start="0" data-duration="${c.len}" data-track-index="1"></div>
  <div id="kicker" class="clip kicker" data-start="0" data-duration="${c.len}" data-track-index="2">${c.kicker}</div>
  <div id="title" class="clip title" data-start="0" data-duration="${c.len}" data-track-index="3">${c.title}</div>
  <div id="sub" class="clip sub" style="top:${subTop}px" data-start="0" data-duration="${c.len}" data-track-index="4">${c.sub}</div>
  ${c.badge ? `<div id="badge" class="clip badge" data-start="0" data-duration="${c.len}" data-track-index="5"><span>${c.badge}</span></div>` : ''}
  ${c.noEnd ? '' : `<div id="end" class="clip end" data-start="${c.len - 0.3}" data-duration="${END + 0.3}" data-track-index="6">
    <img src="assets/fisch.svg" alt="" />
    <div class="brand">Fangpunkt</div>
    <div class="end-title">Link in der <em>Bio</em></div>
    <div class="pill">Kostenlos · ohne Konto</div>
  </div>`}
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.fromTo('#footage', { scale: 1 }, { scale: 1.05, duration: ${c.len}, ease: 'none' }, 0);
  tl.fromTo('#kicker', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, ${c.t[0]});
  tl.fromTo('#title', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, ${c.t[0] + 0.15});
  tl.fromTo('#sub', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, ${c.t[1]});
  ${c.badge ? `tl.fromTo('#badge', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.8);` : ''}
  ${c.noEnd ? `tl.to(['#kicker', '#title', '#sub'], { opacity: 0, duration: 0.35 }, ${c.len - 0.4});` : `
  tl.to(['#kicker', '#title', '#sub'${c.badge ? ", '#badge'" : ''}], { opacity: 0, y: -16, duration: 0.3, ease: 'power2.in' }, ${c.len - 0.6});
  tl.fromTo('#end', { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${c.len - 0.3});
  tl.fromTo('#end img', { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, ${c.len - 0.2});
  tl.fromTo('#end .end-title', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, ${c.len + 0.25});
  tl.fromTo('#end .pill', { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${c.len + 0.55});`}
  window.__timelines['main'] = tl;
  tl.seek(0);
</script>
</body>
</html>
`;
}

// Szenen liegen in szenen/; zum Rendern wird jeweils eine nach index.html kopiert (HyperFrames erlaubt nur eine Hauptdatei)
mkdirSync(`${dir}szenen`, { recursive: true });
for (const c of CLIPS) writeFileSync(`${dir}szenen/${c.id}.html`, html(c));
writeFileSync(`${dir}clips.json`, JSON.stringify(CLIPS.map(({ id, src, len }) => ({ id, src, len })), null, 2) + '\n');
console.log(CLIPS.map((c) => c.id).join('\n'));

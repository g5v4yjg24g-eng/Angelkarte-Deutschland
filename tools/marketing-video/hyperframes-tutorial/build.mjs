// Erklärvideo „Ein Angeltag mit Fangpunkt“ (Storyline A, SPEC.md) – erzeugt index.html.
// Der Sprecher ist der Takt: Szenenlängen kommen aus den Satzlängen (assets/voiceover/tutorial/voiceover.json)
// und den App-Aufnahmen (assets/tutorial/<name>.mp4 + .taps.json, scripts/record-tutorial.mjs).
// Fehlt die Sprecheraufnahme noch, wird die Satzlänge geschätzt (0,36 s je Wort) – nur zum Ansehen.
// Ergebnis: index.html + compositions/*.html aus src/. Aufruf: node build.mjs   (danach: npx --yes hyperframes@0.8.188 check)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const assets = new URL('../assets/', import.meta.url);
const read = (u) => readFileSync(u, 'utf8');
const json = (u) => JSON.parse(read(u));

const cfg = json(new URL('voiceover.config.json', here));
const voFile = new URL('voiceover/tutorial/voiceover.json', assets);
const voReal = existsSync(voFile);
const voDur = voReal ? json(voFile) : {};
const words = (t) => t.replace(/[^\wäöüß ]/gi, ' ').split(/\s+/).filter(Boolean).length;
const vo = Object.fromEntries(cfg.voiceover.map((l) => [l.id, { ...l, dur: voDur[l.id] ?? +(0.4 + words(l.text) * 0.36).toFixed(2) }]));

// App-Aufnahmen: Länge und Tipps; letztes Bild als Standbild zum Halten
const rec = {};
for (const name of ['weather', 'search', 'place', 'session', 'catch', 'catches', 'stats']) {
  const meta = json(new URL(`tutorial/${name}.taps.json`, assets));
  const last = new URL(`tutorial/${name}-last.png`, assets).pathname;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-sseof', '-0.1', '-i', new URL(`tutorial/${name}.mp4`, assets).pathname, '-frames:v', '1', '-update', '1', last]);
  rec[name] = meta;
}

// Handy (steht still): Bildschirm 483,6 × 1048,4 px, Statusleiste 66,4 px, Aufnahme 393 × 798 CSS-px
const PHONE = { left: 280, top: 410, pad: 18.2, status: 66.4, k: 483.6 / 393 };
const toFrame = (x, y) => ({ x: PHONE.left + PHONE.pad + x * PHONE.k, y: PHONE.top + PHONE.pad + PHONE.status + y * PHONE.k });

// --- Ablauf. at = Sprecher-Einsatz in der Szene (s); hold = Mindest-Nachlauf nach dem letzten Satz
const SLIDE = 0.42;
const plan = [
  { id: 'hook', kind: 'clip', lines: [{ id: 't01', at: 0.7 }], min: 3.4, tail: 0.5 },
  { id: 'weather', kind: 'app', rec: 'weather', step: 1, head: ['Wetter &amp;', 'Pegel'], lines: [{ id: 't02', at: 0.5 }], tail: 0.4 },
  { id: 'search', kind: 'app', rec: 'search', step: 2, head: ['Gewässer', 'finden'], lines: [{ id: 't03', at: 0.3 }, { id: 't04', after: 6.4 }], tail: 0.5 },
  { id: 'place', kind: 'app', rec: 'place', step: 3, head: ['Steg', 'markieren'], lines: [{ id: 't05', at: 0.3 }], tail: 0.4 },
  { id: 'session', kind: 'app', rec: 'session', step: 4, head: ['Session', 'starten'], lines: [{ id: 't06', at: 0.25 }], tail: 0.4 },
  { id: 'bite', kind: 'clip', lines: [{ id: 't07', at: 0.35 }], min: 2.2, tail: 0.6 },
  { id: 'catch', kind: 'app', rec: 'catch', step: 5, head: ['Fang', 'erfassen'], lines: [{ id: 't08', at: 0.2 }, { id: 't09', after: 2.2 }, { id: 't10', after: 5.0 }], tail: 0.3 },
  { id: 'release', kind: 'clip', lines: [], min: 2.9, tail: 0 },
  { id: 'catches', kind: 'app', rec: 'catches', step: 6, head: ['Dein', 'Fangbuch'], lines: [{ id: 't11', at: 0.35 }], tail: 0.4 },
  { id: 'stats', kind: 'app', rec: 'stats', step: 7, head: ['Deine', 'Statistik'], lines: [{ id: 't12', at: 0.35 }], tail: 0.5 },
  { id: 'outro', kind: 'clip', lines: [{ id: 't13', at: 0.6 }], min: 8.5, tail: 2.5 },
];
let cursor = 0;
for (const s of plan) {
  let end = 0;
  s.voice = s.lines.map((l) => {
    const at = l.at ?? Math.max(l.after, end + 0.25);
    end = at + vo[l.id].dur;
    return { ...vo[l.id], at };
  });
  const recDur = s.rec ? rec[s.rec].durationS : 0;
  s.start = +cursor.toFixed(3);
  s.dur = +Math.max(s.min ?? 0, recDur, end + s.tail).toFixed(3);
  s.recDur = recDur;
  cursor += s.dur;
}
const TOTAL = +cursor.toFixed(3);
const sc = Object.fromEntries(plan.map((s) => [s.id, s]));

// --- Bausteine
const grade = read(new URL('grade.json', here)).trim();
const gradeBlur = read(new URL('grade-blur.json', here)).trim();
const esc = (s) => s.replace(/"/g, '&quot;');
const fx = (x) => +x.toFixed(3);

const statusBar = `<div class="status" data-layout-ignore>
            <span>9:41</span>
            <svg width="84" height="17" viewBox="0 0 70 14"><rect x="0" y="10" width="3.4" height="4" rx="0.8"/><rect x="5" y="7" width="3.4" height="7" rx="0.8"/><rect x="10" y="4" width="3.4" height="10" rx="0.8"/><rect x="15" y="1" width="3.4" height="13" rx="0.8"/><path d="M28 5.2a10 10 0 0 1 14 0l-1.6 1.6a7.6 7.6 0 0 0-10.8 0zM31.4 8.6a5.2 5.2 0 0 1 7.2 0L35 12.2z"/><rect x="46" y="1.5" width="21" height="11" rx="3" fill="none" stroke="#000" stroke-opacity="0.4"/><rect x="48" y="3.5" width="15" height="7" rx="1.6"/><rect x="68" y="5" width="1.6" height="4" rx="0.6" fill-opacity="0.4"/></svg>
          </div>`;

const apps = plan.filter((s) => s.kind === 'app');
const appStart = sc.weather.start;
const appEnd = sc.stats.start + sc.stats.dur + 0.4; // reicht unter die Blende des Abschlusses

// Alles in der App-Welt zählt ab ihrem Beginn (Unterkomposition)
const rel = (t) => fx(t - appStart);
const AFTER_CLIP = ['catch', 'catches'];

// Bildschirme im Handy: Aufnahme, danach Standbild bis zum Wechsel (+ Wischdauer)
let track = 3;
const screens = apps
  .map((s, i) => {
    const next = apps[i + 1];
    const until = (next ? next.start + SLIDE : appEnd) - s.start;
    const t = track++;
    const hold = until - s.recDur;
    return `            <div class="scr-wrap" id="wrap-${s.id}">
              <video id="scr-${s.id}" class="clip" src="assets/tutorial/${s.rec}.mp4" data-start="${rel(s.start)}" data-duration="${fx(Math.min(s.recDur, until))}" data-media-start="0" data-track-index="${t}" muted playsinline></video>${
      hold > 0.01
        ? `\n              <img id="hold-${s.id}" class="clip" src="assets/tutorial/${s.rec}-last.png" data-start="${rel(s.start + s.recDur)}" data-duration="${fx(hold)}" data-track-index="${t + 20}" alt="" />`
        : ''
    }
            </div>`;
  })
  .join('\n');

// Fingerringe genau an den Tipp-Stellen der Aufnahme
const tapList = apps.flatMap((s) => rec[s.rec].taps.map((p) => ({ t: fx(s.start + p.t), ...toFrame(p.x, p.y) })));
const rings = tapList
  .map((p, i) => `      <div id="tap-${i}" class="tap clip" data-start="${rel(p.t)}" data-duration="0.5" data-track-index="${40 + (i % 3)}" style="left:${fx(p.x)}px;top:${fx(p.y)}px"><i class="dot"></i><i class="ring"></i></div>`)
  .join('\n');

const heads = apps
  .map((s, i) => `      <h2 id="head-${s.id}" class="head clip" data-start="${rel(s.start)}" data-duration="${fx(s.dur)}" data-track-index="${20 + (i % 2)}"><span class="w"><span class="num">${s.step}</span>${s.head[0]}</span> <span class="w accent">${s.head[1]}</span></h2>`)
  .join('\n');

// Fußnote unter dem Handy: Beispieldaten + Quellen des sichtbaren Bildschirms
const MAP = 'Karte: OpenFreeMap © OpenMapTiles, Daten © OpenStreetMap-Mitwirkende';
const notes = {
  weather: 'Beispieldaten · Wetter: Open-Meteo.com (CC BY 4.0) · Pegel: PEGELONLINE (WSV)',
  search: `Beispieldaten · ${MAP}`,
  place: `Beispieldaten · ${MAP}`,
  session: `Beispieldaten · ${MAP}`,
  catch: `Beispieldaten · ${MAP} · Keine Rechtsauskunft`,
  catches: 'Beispieldaten · Wetter: Open-Meteo.com (CC BY 4.0) · Keine Rechtsauskunft',
  stats: 'Beispieldaten',
};
const noteEls = apps
  .map((s, i) => `      <p id="note-${s.id}" class="note clip" data-layout-ignore data-start="${rel(s.start)}" data-duration="${fx(s.dur)}" data-track-index="${22 + (i % 2)}">${notes[s.id]}</p>`)
  .join('\n');

// Ton (Sprecher erst, wenn die Aufnahme geschnitten ist)
const audio = [];
let at = 50;
if (voReal)
  for (const s of plan)
    for (const v of s.voice)
      audio.push(`      <audio id="vo-${v.id}" class="clip" src="assets/voiceover/tutorial/${v.id}.wav" data-start="${fx(s.start + v.at)}" data-duration="${v.dur}" data-track-index="${at++}" data-volume="1" data-audio-group="voiceover"></audio>`);
tapList.forEach((p, i) =>
  audio.push(`      <audio id="sfx-tap-${i}" class="clip" src="assets/graphics/sfx-tap.wav" data-start="${p.t}" data-duration="0.06" data-track-index="${at++}" data-volume="0.4" data-audio-group="sfx"></audio>`),
);
for (const [id, t, file, vol] of [
  ['sfx-iris', sc.hook.start + sc.hook.dur - 0.55, 'sfx-whoosh', 0.35],
  ['sfx-release', sc.release.start + 1.2, 'sfx-splash', 0.35],
  ['sfx-outro', sc.outro.start - 0.3, 'sfx-whoosh', 0.3],
])
  audio.push(`      <audio id="${id}" class="clip" src="assets/graphics/${file}.wav" data-start="${fx(t)}" data-duration="0.7" data-track-index="${at++}" data-volume="${vol}" data-audio-group="sfx"></audio>`);

// Musik unter dem Sprecher absenken (0,14), in Pausen 0,22; Natur nur in den Angelszenen deutlich
const voiceSpans = plan.flatMap((s) => s.voice.map((v) => [s.start + v.at, s.start + v.at + v.dur]));
function duck(low, high, extra = () => null) {
  const pts = [{ t: 0, v: 0 }, { t: 0.4, v: high }];
  for (const [a, b] of voiceSpans) pts.push({ t: fx(a - 0.3), v: high }, { t: fx(a), v: low }, { t: fx(b), v: low }, { t: fx(b + 0.3), v: high });
  pts.push({ t: fx(TOTAL - 0.1), v: high });
  return pts.map((p) => ({ ...p, v: extra(p.t) ?? p.v })).filter((p, i, a) => i === 0 || p.t > a[i - 1].t);
}
const inClip = (t) => ['hook', 'bite', 'release'].some((k) => t >= sc[k].start && t <= sc[k].start + sc[k].dur);
const auto = (pts) => esc(JSON.stringify({ version: 1, lanes: [{ target: 'volume', points: pts }] }));
audio.unshift(
  `      <audio id="music" class="clip" src="assets/music/music-tutorial.wav" data-start="0" data-duration="${TOTAL}" data-track-index="10" data-volume="1" data-audio-group="music" data-automation="${auto(duck(0.14, 0.22))}"></audio>`,
  `      <audio id="ambience" class="clip" src="assets/music/ambience-tutorial.wav" data-start="0" data-duration="${TOTAL}" data-track-index="11" data-volume="1" data-audio-group="music" data-automation="${auto(duck(0.04, 0.08, (t) => (inClip(t) ? 0.3 : null)))}"></audio>`,
);

// Zeitleiste der App-Welt als Daten für das Skript in der Unterkomposition
const timeline = {
  dur: fx(appEnd - appStart),
  apps: apps.map((s) => ({ id: s.id, start: rel(s.start), dur: s.dur, afterClip: AFTER_CLIP.includes(s.id) })),
  taps: tapList.map((p) => rel(p.t)),
  SLIDE,
};

const css = read(new URL('src/style.css', here)).replace(/^/gm, '    ');
const fill = (src) =>
  read(new URL(`src/${src}`, here))
    .replaceAll('{{CSS}}', css.trimEnd())
    .replaceAll('{{TOTAL}}', String(TOTAL))
    .replaceAll('{{GRADE}}', esc(grade))
    .replaceAll('{{GRADE_BLUR}}', esc(gradeBlur))
    .replaceAll('{{STATUS}}', statusBar)
    .replaceAll('{{HOOKX}}', String(fx(sc.hook.dur + 0.7)))
    .replaceAll('{{RINGS_AT}}', String(fx(sc.hook.dur - 0.75)))
    .replaceAll('{{BITE_WORD}}', String(fx(sc.bite.dur - 0.3)))
    .replace('{{SCREENS}}', screens)
    .replace('{{HEADS}}', heads)
    .replace('{{NOTES}}', noteEls)
    .replace('{{RINGS}}', rings)
    .replace('{{AUDIO}}', audio.join('\n'))
    .replace('{{TIMELINE}}', JSON.stringify(timeline))
    .replace(/\{\{APP\.(start|dur)\}\}/g, (_, k) => String(fx(k === 'start' ? appStart : appEnd - appStart)))
    .replace(/\{\{(\w+)\.(start|dur)\}\}/g, (_, id, k) => String(fx(sc[id][k])));
mkdirSync(new URL('compositions/', here), { recursive: true });
writeFileSync(new URL('index.html', here), fill('index.html'));
for (const c of ['hook', 'world', 'bite', 'release', 'outro']) writeFileSync(new URL(`compositions/${c}.html`, here), fill(`${c}.html`));

const lines = plan.map((s) => `${s.id.padEnd(8)} ${s.start.toFixed(2).padStart(6)} s  +${s.dur.toFixed(2)} s  ${s.voice.map((v) => `${v.id}@${v.at.toFixed(2)}(${v.dur})`).join(' ')}`);
writeFileSync(new URL('timing.txt', here), `Gesamt ${TOTAL} s · Sprecher ${voReal ? 'echt' : 'GESCHÄTZT (noch ohne Ton)'}\n${lines.join('\n')}\nQR unbewegt ab ${fx(sc.outro.start + 3)} s\n`);
console.log(read(new URL('timing.txt', here)));

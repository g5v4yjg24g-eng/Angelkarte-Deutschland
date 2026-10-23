// Funktionsanimation „Session-Rückblick mit GPS-Route“ (SPEC.md) – erzeugt index.html und compositions/route.html.
// Die GPS-Punkte kommen aus einer Simulation mit denselben Regeln wie app/src/domain/track.ts (decideFix):
// Genauigkeit ≤ 50 m, höchstens alle 10 s, Abstand ≥ max(8 m, Ungenauigkeit), ≤ 15 m/s, Neustart = neuer Abschnitt.
// Rauschen mit festem Startwert, damit jeder Lauf dasselbe Bild ergibt. Aufruf: node build.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const fx = (x, d = 2) => +x.toFixed(d);

// --- Regeln (wie domain/track.ts)
const MAX_ACCURACY_M = 50;
const MIN_INTERVAL_S = 10;
const MIN_STEP_M = 8;
const MAX_SPEED_MS = 15;

// --- Maßstab und Zeitraffer
const M_PER_PX = 0.3125; // 1920 px Bildbreite ≈ 600 m
const SPEED_MS = 1.2; // Gehen am Ufer
const C = 35; // Zeitraffer: 35 s Wirklichkeit je Videosekunde
const T0 = 2.4; // Video-Sekunde, in der die Session beginnt
const CLOCK0 = 6 * 3600 + 12 * 60; // 06:12:00

// --- Ufer und Weg (Schlangenlinie entlang des Ufers)
const CX = 640, CY = 560, RX = 400, RY = 250;
const k = (th) => 1 + 0.05 * Math.sin(3 * th) + 0.035 * Math.cos(5 * th + 1);
const shore = (th) => [CX + RX * k(th) * Math.cos(th), CY + RY * k(th) * Math.sin(th)];
const rad = (d) => (d * Math.PI) / 180;
const lakePath = (() => {
  const pts = [];
  for (let d = 0; d < 360; d += 3) pts.push(shore(rad(d)).map((v) => fx(v, 1)).join(','));
  return `M${pts.join('L')}Z`;
})();

// Grundlinie: Ufer, 50 px nach außen versetzt; darauf eine Schlangenlinie (Amplitude 24 px, Wellenlänge 250 px)
const base = [];
for (let d = 165; d >= -40; d -= 0.05) {
  const th = rad(d);
  const [x, y] = shore(th);
  const [x2, y2] = shore(th - 0.0005);
  const tx = x2 - x, ty = y2 - y, n = Math.hypot(tx, ty);
  // nach außen zeigende Normale (Umlauf rückwärts → rechts der Laufrichtung ist außen)
  base.push({ x, y, nx: -ty / n, ny: tx / n });
}
// Normale prüfen: soll vom Seemittelpunkt weg zeigen
if ((base[0].x - CX) * base[0].nx + (base[0].y - CY) * base[0].ny < 0) for (const b of base) { b.nx *= -1; b.ny *= -1; }
let s = 0;
const walk = [];
for (let i = 0; i < base.length; i++) {
  if (i) s += Math.hypot(base[i].x - base[i - 1].x, base[i].y - base[i - 1].y);
  const off = 50 + 24 * Math.sin((2 * Math.PI * s) / 250);
  walk.push({ s, x: base[i].x + base[i].nx * off, y: base[i].y + base[i].ny * off, nx: base[i].nx, ny: base[i].ny });
}
// Bogenlänge des wirklichen (geschlängelten) Wegs
let L = 0;
walk[0].L = 0;
for (let i = 1; i < walk.length; i++) walk[i].L = L += Math.hypot(walk[i].x - walk[i - 1].x, walk[i].y - walk[i - 1].y);
function at(len) {
  len = Math.max(0, Math.min(L, len));
  let lo = 0, hi = walk.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (walk[m].L < len) lo = m; else hi = m; }
  const a = walk[lo], b = walk[hi], f = (len - a.L) / (b.L - a.L || 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, nx: a.nx, ny: a.ny };
}

// --- Ablauf in echter Zeit (s): Gehen, Stehen (Angeln), App im Hintergrund
const phases = [
  { kind: 'walk', to: 0.3 },
  { kind: 'stop', dur: 77, event: { id: 'hecht', label: 'Fang · Hecht', species: 'Hecht', cm: 68 } },
  { kind: 'walk', to: 0.6 },
  { kind: 'walk', to: 0.77, background: true },
  { kind: 'walk', to: 0.89 },
  { kind: 'stop', dur: 42, event: { id: 'barsch', label: 'Fang · Barsch', species: 'Barsch', cm: 31 } },
  { kind: 'walk', to: 1.0 },
];
let tReal = 0, pos = 0;
const sched = []; // { a, b (Echtzeit), from, to (px), background }
for (const p of phases) {
  if (p.kind === 'walk') {
    const to = p.to * L, dur = ((to - pos) * M_PER_PX) / SPEED_MS;
    sched.push({ a: tReal, b: tReal + dur, from: pos, to, background: !!p.background });
    tReal += dur; pos = to;
  } else {
    sched.push({ a: tReal, b: tReal + p.dur, from: pos, to: pos, event: p.event });
    tReal += p.dur;
  }
}
const REAL_END = tReal;
const lenAt = (t) => {
  for (const q of sched) if (t <= q.b) return q.from + (q.to - q.from) * ((t - q.a) / (q.b - q.a || 1));
  return L;
};
const recordingAt = (t) => !sched.find((q) => t >= q.a && t < q.b && q.background);
const vt = (t) => fx(T0 + t / C, 3); // Echtzeit → Videozeit

// --- GPS simulieren (ein Fix je Sekunde) und mit den Regeln entscheiden
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const segments = [];
const shown = []; // verworfene Fixe, die das Bild zeigt
let last = null, lastShownClose = -Infinity, wasRecording = true, injectedAcc = false, injectedJump = false;
const walk1 = sched[0], walk2 = sched[2];
for (let t = 0; t <= REAL_END + 0.01; t += 1) {
  const rec = recordingAt(t);
  if (!rec) { wasRecording = false; continue; }
  const p = at(lenAt(t));
  let f = { x: p.x + gauss() * (1.5 / M_PER_PX), y: p.y + gauss() * (1.5 / M_PER_PX), acc: 5 + rnd() * 3, t };
  const restart = !wasRecording;
  wasRecording = true;
  const due = last && t - last.t >= MIN_INTERVAL_S;
  // Beispiel 1: ein ungenauer Fix (Funkzelle/WLAN) mitten im ersten Wegstück
  if (!injectedAcc && due && t > walk1.a + 0.55 * (walk1.b - walk1.a)) { f = { ...f, acc: 60 }; injectedAcc = true; }
  // Beispiel 2: ein Sprung des GPS im zweiten Wegstück
  if (!injectedJump && due && t > walk2.a + 0.5 * (walk2.b - walk2.a)) {
    const jumpPx = 560;
    let jx = p.x + p.nx * jumpPx, jy = p.y + p.ny * jumpPx;
    if (jx > 1240 || jy > 1040 || jy < 40 || jx < 40) { jx = p.x - p.nx * jumpPx; jy = p.y - p.ny * jumpPx; }
    f = { ...f, x: jx, y: jy };
    injectedJump = true;
  }
  let decision;
  if (!(f.acc <= MAX_ACCURACY_M)) decision = 'inaccurate';
  else if (!last) decision = 'newSegment';
  else if (restart) decision = 'newSegment';
  else if (t - last.t < MIN_INTERVAL_S) decision = 'tooSoon';
  else {
    const d = Math.hypot(f.x - last.x, f.y - last.y) * M_PER_PX;
    if (d < Math.max(MIN_STEP_M, Math.min(f.acc, last.acc))) decision = 'tooClose';
    else if (d / (t - last.t) > MAX_SPEED_MS) decision = 'jump';
    else decision = 'append';
  }
  if (decision === 'newSegment') { segments.push([f]); last = f; lastShownClose = t; }
  else if (decision === 'append') { segments.at(-1).push(f); last = f; lastShownClose = t; }
  // „zu nah“ prüft die App jede Sekunde; gezeigt wird davon nur einer alle 10 s
  else if (decision === 'tooClose') { if (t - lastShownClose >= MIN_INTERVAL_S) { shown.push({ ...f, why: decision }); lastShownClose = t; } }
  else if (decision !== 'tooSoon') shown.push({ ...f, why: decision, from: last ? { x: last.x, y: last.y } : null });
}
const points = segments.flat();
const distM = segments.reduce((sum, sg) => sum + sg.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - sg[i].x, p.y - sg[i].y), 0), 0) * M_PER_PX;
const events = sched.filter((q) => q.event).map((q) => {
  const t = (q.a + q.b) / 2;
  const near = points.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b));
  return { ...q.event, t, x: near.x, y: near.y };
});

// --- Videozeiten
const REC_END = vt(REAL_END); // Ende der Session-Simulation
const STOP_TAP = fx(REC_END + 0.35);
const REVIEW = fx(STOP_TAP + 0.7); // Rückblick beginnt
const PLAY = fx(REVIEW + 1.0); // Wiedergabe startet
const SLOW = 4.0, SLOW_FRAC = 0.2, FAST_FRAC_PER_S = 0.2; // 1× für 20 % der Zeit in 4 s, dann 4×
const FAST_AT = fx(PLAY + SLOW);
const PLAY_END = fx(FAST_AT + (1 - SLOW_FRAC) / FAST_FRAC_PER_S);
const HIGHLIGHTS = fx(PLAY_END + 0.4);
const H2 = fx(HIGHLIGHTS + 4.2); // Fang-Highlights und Besondere Momente
const OUTRO = fx(H2 + 4.4);
const ROUTE_END = fx(OUTRO + 3.4);
// Zum Schluss: echte Aufnahme des Rückblicks im Handy (scripts/record-tutorial.mjs --only=review)
const reviewRec = JSON.parse(readFileSync(new URL('../assets/tutorial/review.taps.json', import.meta.url), 'utf8'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-sseof', '-0.1', '-i', new URL('../assets/tutorial/review.mp4', import.meta.url).pathname, '-frames:v', '1', '-update', '1', new URL('../assets/tutorial/review-last.png', import.meta.url).pathname]);
const PHONE = fx(ROUTE_END - 0.4);
const PHONE_DUR = fx(reviewRec.durationS + 1.5);
const TOTAL = fx(PHONE + PHONE_DUR, 1);
const replayT = (t) => {
  const f = t / REAL_END;
  return fx(f <= SLOW_FRAC ? PLAY + (f / SLOW_FRAC) * SLOW : FAST_AT + (f - SLOW_FRAC) / FAST_FRAC_PER_S, 3);
};

// --- SVG-Bausteine
const P = (p) => `${fx(p.x, 1)},${fx(p.y, 1)}`;
// wirklicher Weg (blass gepunktet), als ein Pfad, der mit dem Angler wächst
const trueD = 'M' + walk.filter((_, i) => i % 20 === 0).map(P).join('L');
const lines = [];
segments.forEach((sg, si) => sg.slice(1).forEach((p, i) => {
  const a = sg[i];
  lines.push({ id: `ln-${lines.length}`, a, b: p, len: Math.hypot(p.x - a.x, p.y - a.y), si });
}));
const lineEls = (cls) => lines.map((l) => `<line id="${cls}-${l.id}" class="${cls}" x1="${fx(l.a.x, 1)}" y1="${fx(l.a.y, 1)}" x2="${fx(l.b.x, 1)}" y2="${fx(l.b.y, 1)}" stroke-dasharray="${fx(l.len, 1)}" stroke-dashoffset="${fx(l.len, 1)}" opacity="0" />`).join('\n          ');
const dotEls = points.map((p, i) => `<circle id="pt-${i}" class="pt" cx="${fx(p.x, 1)}" cy="${fx(p.y, 1)}" r="7" />`).join('\n          ');
const rejEls = shown.map((r, i) => {
  if (r.why === 'inaccurate')
    return `<g id="rej-${i}" class="rej"><circle cx="${fx(r.x, 1)}" cy="${fx(r.y, 1)}" r="${fx(60 / M_PER_PX, 1)}" class="acc" /><circle cx="${fx(r.x, 1)}" cy="${fx(r.y, 1)}" r="7" class="rejdot" /></g>`;
  if (r.why === 'jump')
    return `<g id="rej-${i}" class="rej"><line x1="${fx(r.from.x, 1)}" y1="${fx(r.from.y, 1)}" x2="${fx(r.x, 1)}" y2="${fx(r.y, 1)}" class="jumpline" /><circle cx="${fx(r.x, 1)}" cy="${fx(r.y, 1)}" r="8" class="rejdot" /></g>`;
  return `<g id="rej-${i}" class="rej"><circle cx="${fx(r.x, 1)}" cy="${fx(r.y, 1)}" r="5" class="rejdot" /></g>`;
}).join('\n          ');
const evEls = events.map((e) => `<g id="ev-${e.id}" class="ev"><circle cx="${fx(e.x, 1)}" cy="${fx(e.y, 1)}" r="15" class="evring" /><circle cx="${fx(e.x, 1)}" cy="${fx(e.y, 1)}" r="7" class="evdot" /></g>`).join('\n          ');

// Beschriftungen am Objekt (mit Führungslinie): Ankerpunkt, Versatz, Zeiten
const first = points[0], lastP = points.at(-1);
const acc = shown.find((r) => r.why === 'inaccurate');
const jump = shown.find((r) => r.why === 'jump');
const close = shown.filter((r) => r.why === 'tooClose');
const firstClose = close.find((r) => r.t > sched[1].a) ?? close[0];
const bgStart = sched[3], resume = segments[1]?.[0];
const clock = (t) => { const c = CLOCK0 + Math.round(t); return `${String(Math.floor(c / 3600)).padStart(2, '0')}:${String(Math.floor(c / 60) % 60).padStart(2, '0')}`; };
const labels = [
  { id: 'lb-every', p: points[2], dx: -40, dy: 150, text: 'höchstens alle 10 s ein Punkt', t: vt(points[2].t) + 0.1, until: vt(acc.t) - 0.2 },
  { id: 'lb-acc', p: acc, dx: 0, dy: -260, text: 'zu ungenau (± 60 m) – verworfen', t: vt(acc.t), until: vt(acc.t) + 1.7, reject: true },
  { id: 'lb-close', p: firstClose, dx: 60, dy: 170, text: 'weniger als 8 m bewegt – verworfen', t: vt(firstClose.t), until: vt(sched[1].b) + 0.2, reject: true },
  { id: 'lb-hecht', p: events[0], dx: -330, dy: -120, text: `${events[0].label} · ${clock(events[0].t)} Uhr`, t: vt(events[0].t), until: REC_END + 0.3, event: true },
  { id: 'lb-jump', p: jump, dx: 30, dy: 80, text: 'Sprung, schneller als 54 km/h – verworfen', t: vt(jump.t), until: vt(jump.t) + 1.7, reject: true },
  { id: 'lb-bg', p: at(lenAt(bgStart.a + (bgStart.b - bgStart.a) * 0.45)), dx: 60, dy: -140, text: 'App im Hintergrund – keine Punkte', t: vt(bgStart.a) + 0.1, until: vt(bgStart.b) + 0.1 },
  { id: 'lb-gap', p: resume, dx: 70, dy: -120, text: 'neuer Abschnitt – Lücke bleibt offen', t: vt(resume.t), until: vt(resume.t) + 1.9 },
  { id: 'lb-barsch', p: events[1], dx: -40, dy: -150, text: `${events[1].label} · ${clock(events[1].t)} Uhr`, t: vt(events[1].t), until: REC_END + 0.3, event: true },
];
for (const l of labels) {
  l.until = Math.max(l.until, l.t + 0.5 + 0.3 * l.text.split(/\s+/).length + 0.2);
  const hw = l.text.length * 7.6 + 22;
  l.lx = fx(Math.min(1250 - hw, Math.max(30 + hw, l.p.x + l.dx)), 1);
  l.ly = fx(Math.min(960, Math.max(60, l.p.y + l.dy)), 1);
}
const labelEls = labels.map((l) => `<div id="${l.id}" class="lbl${l.reject ? ' reject' : ''}${l.event ? ' event' : ''} clip" data-start="${fx(l.t, 3)}" data-duration="${fx(l.until - l.t, 3)}" data-track-index="${30 + (labels.indexOf(l) % 3)}" style="left:${l.lx}px;top:${l.ly}px">${l.text}</div>`).join('\n      ');
const leaderEls = labels.map((l) => `<line id="ld-${l.id}" class="leader" x1="${fx(l.p.x, 1)}" y1="${fx(l.p.y, 1)}" x2="${l.lx}" y2="${l.ly}" />`).join('\n          ');

// --- Daten für die Zeitleiste in der Seite (alles vorab berechnet, die Seite rechnet nichts Zufälliges)
const STEP = 0.1;
const wk = { x: [], y: [], l: [] };
const trueLen = (() => { let s2 = 0; const pts = walk.filter((_, i) => i % 20 === 0); for (let i = 1; i < pts.length; i++) s2 += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return s2; })();
for (let v = 0; v <= REC_END - T0 + 1e-9; v += STEP) {
  const len = lenAt(v * C), p = at(len);
  wk.x.push(fx(p.x, 1)); wk.y.push(fx(p.y, 1)); wk.l.push(fx(trueLen * (1 - len / L), 1));
}
const D = {
  T0, REC_END, STOP_TAP, REVIEW, PLAY, FAST_AT, PLAY_END, HIGHLIGHTS, H2, OUTRO, TOTAL: ROUTE_END, STEP, C,
  walk: wk,
  trueLen: fx(trueLen, 1),
  pts: points.map((p) => ({ t: vt(p.t), r: replayT(p.t) })),
  lines: lines.map((l) => ({ id: l.id, len: fx(l.len, 1), t: vt(l.b.t), r0: replayT(l.a.t), r1: replayT(l.b.t), si: l.si })),
  rej: shown.map((r) => ({ t: vt(r.t), why: r.why })),
  ev: events.map((e) => ({ id: e.id, t: vt(e.t), r: replayT(e.t) })),
  head: points.map((p) => ({ r: replayT(p.t), x: fx(p.x, 1), y: fx(p.y, 1) })),
  bg: [vt(bgStart.a), vt(bgStart.b)],
  clock0: CLOCK0,
  count: points.map((p) => vt(p.t)),
};
const minutes = Math.round(REAL_END / 60);
// Highlights wie im Rückblick der App (ReviewHighlights.tsx / domain/sessionReview.ts), aus der Simulation
const burstMin = Math.round((events.at(-1).t - events[0].t) / 60); // beide Fänge liegen im 30-min-Fenster
const longestEv = events.reduce((a, b) => (b.cm > a.cm ? b : a));
const km = (distM / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 });

const html = `<template>
  <style>
    @font-face { font-family: "Fraunces Variable"; font-weight: 100 900; src: url("assets/fonts/fraunces-latin-wght-normal.woff2") format("woff2-variations"); }
    @font-face { font-family: "Fraunces Variable"; font-weight: 100 900; src: url("assets/fonts/fraunces-latin-ext-wght-normal.woff2") format("woff2-variations"); unicode-range: U+0100-024F; }
    @font-face { font-family: "Inter Variable"; font-weight: 100 900; src: url("assets/fonts/inter-latin-wght-normal.woff2") format("woff2-variations"); }
    @font-face { font-family: "Inter Variable"; font-weight: 100 900; src: url("assets/fonts/inter-latin-ext-wght-normal.woff2") format("woff2-variations"); unicode-range: U+0100-024F; }
    #root { position: absolute; inset: 0; overflow: hidden; background: #0b2a33; font-family: "Inter Variable", Inter, sans-serif; }
    #map { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
    .land { fill: #0e3540; }
    .lake { fill: #17566a; stroke: #5cc4d6; stroke-width: 3; }
    .lake-name { font: italic 600 32px "Inter Variable", Inter, sans-serif; fill: rgba(232, 244, 245, 0.75); letter-spacing: 4px; }
    .trail { fill: none; stroke: rgba(232, 244, 245, 0.42); stroke-width: 3; stroke-linecap: round; }
    .casing { stroke: #0b1f22; stroke-width: 12; stroke-linecap: round; }
    .route { stroke: #7fd1c7; stroke-width: 6; stroke-linecap: round; }
    .pt { fill: #7fd1c7; stroke: #0b1f22; stroke-width: 3; opacity: 0; }
    .rej { opacity: 0; }
    .rejdot { fill: #9aa9ad; stroke: #0b1f22; stroke-width: 2; }
    .acc { fill: rgba(154, 169, 173, 0.12); stroke: #9aa9ad; stroke-width: 2.5; stroke-dasharray: 10 8; }
    .jumpline { stroke: #9aa9ad; stroke-width: 2.5; stroke-dasharray: 10 8; }
    .ev { opacity: 0; }
    .evring { fill: #0b1f22; stroke: #f2b65a; stroke-width: 5; }
    .evdot { fill: #f2b65a; }
    .leader { stroke: rgba(232, 244, 245, 0.55); stroke-width: 2; opacity: 0; }
    #walker { fill: #fff; stroke: #0b1f22; stroke-width: 4; }
    #head { fill: #7fd1c7; stroke: #fff; stroke-width: 4; opacity: 0; }
    .mk-start { fill: #6fcf97; stroke: #0b1f22; stroke-width: 4; }
    .mk-end { fill: #eaf3f2; stroke: #0b1f22; stroke-width: 4; }
    #labels { position: absolute; inset: 0; }
    .lbl { position: absolute; transform: translate(-50%, -50%); padding: 10px 18px; border-radius: 12px; background: rgba(11, 31, 34, 0.92); color: #e8f4f5; font: 600 28px/1.2 "Inter Variable", Inter, sans-serif; white-space: nowrap; border: 2px solid rgba(127, 209, 199, 0.6); }
    .lbl.reject { border-color: #9aa9ad; color: #d5dde0; }
    .lbl.event { border-color: #f2b65a; }
    /* rechte Spalte */
    #side { position: absolute; left: 1330px; top: 0; width: 530px; height: 1080px; }
    .kicker { position: absolute; left: 0; top: 150px; font: 650 28px "Inter Variable", Inter, sans-serif; letter-spacing: 3px; color: #5cc4d6; }
    .big { position: absolute; left: 0; top: 196px; width: 530px; font-family: "Fraunces Variable", Georgia, serif; font-weight: 640; font-size: 64px; line-height: 1.1; color: #fff; }
    .big .w { display: inline-block; }
    .big .accent { color: #7fd1c7; }
    .status { position: absolute; left: 0; top: 470px; display: flex; align-items: center; gap: 14px; padding: 14px 22px; border-radius: 999px; background: rgba(127, 209, 199, 0.14); color: #e8f4f5; font: 600 28px "Inter Variable", Inter, sans-serif; }
    .status i { width: 16px; height: 16px; border-radius: 50%; background: #6fcf97; }
    #st-bg { background: rgba(154, 169, 173, 0.16); }
    #st-bg i { background: #9aa9ad; }
    #clock { position: absolute; left: 0; top: 570px; font: 600 64px "Inter Variable", Inter, sans-serif; color: #fff; font-variant-numeric: tabular-nums; }
    #clock-note { position: absolute; left: 0; top: 652px; font: 500 28px "Inter Variable", Inter, sans-serif; color: rgba(232, 244, 245, 0.7); }
    #count { position: absolute; left: 0; top: 720px; font: 500 28px "Inter Variable", Inter, sans-serif; color: #e8f4f5; font-variant-numeric: tabular-nums; }
    #stop-btn { position: absolute; left: 0; top: 820px; padding: 20px 34px; border-radius: 999px; background: #e8f4f5; color: #0b2a33; font: 650 30px "Inter Variable", Inter, sans-serif; }
    #tap { position: absolute; width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1.5px rgba(11, 42, 51, 0.55); }
    #controls { position: absolute; left: 0; top: 440px; width: 530px; }
    .ctl-row { display: flex; gap: 12px; align-items: center; }
    .chip { padding: 10px 20px; border-radius: 999px; background: rgba(232, 244, 245, 0.1); color: #e8f4f5; font: 600 28px "Inter Variable", Inter, sans-serif; }
    .chip.play { width: 58px; height: 58px; padding: 0; display: flex; align-items: center; justify-content: center; background: #7fd1c7; }
    #bar { position: relative; margin-top: 26px; width: 530px; height: 10px; border-radius: 5px; background: rgba(232, 244, 245, 0.16); overflow: hidden; }
    #bar-fill { position: absolute; left: 0; top: 0; width: 530px; height: 10px; background: #7fd1c7; transform-origin: 0 50%; }
    .hl { position: absolute; left: 0; top: 400px; width: 540px; }
    .hl h3 { font: 650 28px "Inter Variable", Inter, sans-serif; letter-spacing: 3px; color: #5cc4d6; margin-bottom: 14px; }
    .hl h3 em { font-style: normal; letter-spacing: 0; font-weight: 500; color: rgba(232, 244, 245, 0.6); }
    .hl h3.sub { margin-top: 22px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .tile { padding: 14px 18px; border-radius: 16px; background: rgba(232, 244, 245, 0.08); border: 1.5px solid rgba(232, 244, 245, 0.14); }
    .tile span { display: block; white-space: nowrap; font-family: "Fraunces Variable", Georgia, serif; font-weight: 700; font-size: 44px; line-height: 1.1; color: #fff; }
    .tile b { display: block; margin-top: 4px; font: 600 28px "Inter Variable", Inter, sans-serif; color: #e8f4f5; }
    .tile small { display: block; font: 500 28px "Inter Variable", Inter, sans-serif; color: rgba(232, 244, 245, 0.7); }
    .counts { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 16px; font: 500 28px "Inter Variable", Inter, sans-serif; color: #e8f4f5; }
    .counts i { display: inline-block; width: 18px; height: 18px; border-radius: 50%; margin-right: 10px; vertical-align: -1px; }
    .moment { padding: 14px 20px; border-radius: 14px; background: rgba(242, 182, 90, 0.16); font: 600 28px "Inter Variable", Inter, sans-serif; color: #fff; }
    #outro-line { position: absolute; left: 0; top: 940px; width: 530px; font: 500 28px/1.4 "Inter Variable", Inter, sans-serif; color: #e8f4f5; }
    #footnote { position: absolute; left: 60px; bottom: 28px; font: 500 28px "Inter Variable", Inter, sans-serif; color: rgba(232, 244, 245, 0.55); }
  </style>
  <div id="root" data-composition-id="route" data-width="1920" data-height="1080">
    <svg id="map" viewBox="0 0 1920 1080" data-layout-allow-overflow>
      <rect class="land" x="0" y="0" width="1280" height="1080" rx="0" />
      <path id="lake" class="lake" d="${lakePath}" />
      <text class="lake-name" x="${CX}" y="${CY + 10}" text-anchor="middle">SEE</text>
      <mask id="trail-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
        <path id="trail-mask-path" d="${trueD}" fill="none" stroke="#fff" stroke-width="16" stroke-dasharray="${fx(trueLen, 1)} ${fx(trueLen, 1)}" stroke-dashoffset="${fx(trueLen, 1)}" />
      </mask>
      <path id="trail" class="trail" d="${trueD}" stroke-dasharray="3 12" mask="url(#trail-mask)" />
      <g id="g-casing">
          ${lineEls('casing')}
      </g>
      <g id="g-route">
          ${lineEls('route')}
      </g>
      <g id="g-pts">
          ${dotEls}
      </g>
      <g id="g-rej">
          ${rejEls}
      </g>
      <g id="g-leaders">
          ${leaderEls}
      </g>
      <g id="g-ev">
          ${evEls}
      </g>
      <circle id="mk-start" class="mk-start" cx="${fx(first.x, 1)}" cy="${fx(first.y, 1)}" r="13" />
      <circle id="mk-end" class="mk-end" cx="${fx(lastP.x, 1)}" cy="${fx(lastP.y, 1)}" r="13" />
      <circle id="walker" cx="0" cy="0" r="13" />
      <circle id="head" cx="0" cy="0" r="12" />
    </svg>
    <div id="labels">
      ${labelEls}
    </div>

    <div id="side">
      <div id="rec-side" class="clip" data-start="0" data-duration="${REVIEW}" data-track-index="2">
        <div class="kicker">WÄHREND DER SESSION</div>
        <h1 class="big" id="big-rec"><span class="w">Fangpunkt</span> <span class="w">zeichnet</span> <span class="w">deinen</span> <span class="w accent">Weg</span> <span class="w">auf.</span></h1>
        <div id="st-rec" class="status"><i></i>GPS aktiv – Route wird aufgezeichnet.</div>
        <div id="st-bg" class="status"><i></i>App im Hintergrund</div>
        <div id="clock">06:12:00</div>
        <div id="clock-note">Uhrzeit der Session · Zeitraffer ×${C}</div>
        <div id="count">Gespeicherte Punkte: 0</div>
        <div id="stop-btn">Session beenden</div>
      </div>
      <div id="rev-side" class="clip" data-start="${REVIEW}" data-duration="${fx(ROUTE_END - REVIEW)}" data-track-index="3">
        <div class="kicker">NACH DEM BEENDEN</div>
        <h1 class="big" id="big-rev"><span class="w">Dein</span> <span class="w">Angeltrip</span> <span class="w">im</span> <span class="w accent">Rückblick</span></h1>
        <div id="controls">
          <div class="ctl-row">
            <div class="chip play"><svg width="22" height="24" viewBox="0 0 22 24"><path d="M2 1L21 12L2 23Z" fill="#0b2a33" /></svg></div>
            <div class="chip" id="sp-1">1×</div>
            <div class="chip" id="sp-2">2×</div>
            <div class="chip" id="sp-4">4×</div>
          </div>
          <div id="bar"><div id="bar-fill"></div></div>
        </div>
        <div id="hl1" class="hl">
          <h3>DEINE HIGHLIGHTS <em>· Beispielwerte</em></h3>
          <div class="grid">
            <div class="tile"><span>${minutes} min</span><b>Dauer</b></div>
            <div class="tile"><span>${km} km</span><b>Strecke</b></div>
            <div class="tile"><span>${events.length}</span><b>Einträge</b></div>
            <div class="tile"><span>${events.length}</span><b>Bisse gesamt</b></div>
          </div>
          <ul class="counts">
            <li><i style="background:#f2994a"></i>${events.length} Gefangen</li>
            <li><i style="background:#b8742a"></i>0 Verloren</li>
            <li><i style="background:#9aa9ad"></i>0 Bisse ohne Haken</li>
            <li><i style="background:#5cc4d6"></i>0 Gesichtet</li>
          </ul>
        </div>
        <div id="hl2" class="hl" data-hold>
          <h3>FANG-HIGHLIGHTS <em>· Beispielwerte</em></h3>
          <div class="grid">
            <div class="tile"><span>${longestEv.cm} cm</span><b>Größter Fisch</b><small>${longestEv.species}</small></div>
            <div class="tile"><span>${events.length}</span><b>Arten</b></div>
            <div class="tile"><span>${clock(events[0].t)}</span><b>Erster Fang</b><small>${events[0].species}</small></div>
            <div class="tile"><span>${clock(events.at(-1).t)}</span><b>Letzter Fang</b><small>${events.at(-1).species}</small></div>
          </div>
          <h3 class="sub">BESONDERE MOMENTE</h3>
          <div class="moment">${events.length} Fänge innerhalb von ${burstMin} Minuten</div>
        </div>
        <p id="outro-line">Nur bei geöffneter App aufgezeichnet · die Route bleibt auf deinem Gerät.</p>
      </div>
    </div>
    <div id="tap" style="left:1480px;top:857px" class="clip" data-start="${STOP_TAP}" data-duration="0.5" data-track-index="4"></div>
    <p id="footnote" data-layout-ignore>Schematische Darstellung · Regeln wie in der App (Session-Rückblick)</p>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const D = ${JSON.stringify(D)};
    const tl = gsap.timeline({ paused: true });

    // Karte entsteht: Land, See, Uferlinie zeichnet sich
        tl.fromTo("#lake", { strokeDasharray: "3200 3200", strokeDashoffset: 3200 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" }, 0.2);
    tl.fromTo(["#big-rec .w"], { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power2.out", stagger: 0.067 }, 0.2);
    tl.fromTo(["#rec-side .kicker", "#st-rec", "#clock", "#clock-note", "#count"], { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.08 }, 1.4);
    tl.set("#st-bg", { opacity: 0 }, 0);
    tl.fromTo("#stop-btn", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, 2.0);

    // Angler läuft (vorab berechnete Schlangenlinie), dahinter der wirkliche Weg
    tl.set("#walker", { attr: { cx: D.walk.x[0], cy: D.walk.y[0] }, opacity: 0 }, 0);
    tl.to("#walker", { opacity: 1, duration: 0.3 }, D.T0 - 0.3);
    tl.to("#walker", { keyframes: D.walk.x.slice(1).map((x, i) => ({ attr: { cx: x, cy: D.walk.y[i + 1] }, duration: D.STEP, ease: "none" })) }, D.T0);
    // der wirkliche Weg wächst über eine Maske mit dem Angler
    tl.to("#trail-mask-path", { keyframes: D.walk.l.slice(1).map((v) => ({ attr: { "stroke-dashoffset": v }, duration: D.STEP, ease: "none" })) }, D.T0);
    tl.set("#mk-start", { opacity: 0, scale: 0, transformOrigin: "50% 50%" }, 0);
    tl.set("#mk-end", { opacity: 0, scale: 0, transformOrigin: "50% 50%" }, 0);
    tl.to("#mk-start", { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" }, D.pts[0].t);

    // Gespeicherte Punkte und Linien erscheinen, wenn die Regeln den Fix annehmen
    D.pts.forEach((p, i) => tl.fromTo("#pt-" + i, { opacity: 0, scale: 0.3, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.22, ease: "back.out(2)" }, p.t));
    D.lines.forEach((l) => {
      tl.set(["#casing-" + l.id, "#route-" + l.id], { opacity: 1 }, l.t - 0.1);
      tl.to(["#casing-" + l.id, "#route-" + l.id], { attr: { "stroke-dashoffset": 0 }, duration: 0.18, ease: "power1.out" }, l.t - 0.1);
    });
    // Verworfene Fixe: kurz sichtbar, dann weg
    D.rej.forEach((r, i) => {
      const hold = r.why === "tooClose" ? 0.35 : 1.4;
      tl.fromTo("#rej-" + i, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "power2.out" }, r.t);
      tl.to("#rej-" + i, { opacity: 0, duration: 0.3, ease: "power2.in" }, r.t + hold);
    });
    // Fänge zu ihrem Zeitpunkt
    D.ev.forEach((e) => tl.fromTo("#ev-" + e.id, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.8)" }, e.t));
    // Führungslinien mit ihren Beschriftungen
    ${JSON.stringify(labels.map((l) => ({ id: l.id, t: fx(l.t, 3), until: fx(l.until, 3) })))}.forEach((l) => {
      tl.fromTo("#ld-" + l.id, { opacity: 0 }, { opacity: 1, duration: 0.2 }, l.t);
      tl.to("#ld-" + l.id, { opacity: 0, duration: 0.15 }, l.until - 0.15);
      tl.fromTo("#" + l.id, { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.18, ease: "power2.out" }, l.t);
      tl.to("#" + l.id, { opacity: 0, duration: 0.15, ease: "power2.in" }, l.until - 0.15);
    });
    // App im Hintergrund: Angler blasser, Status wechselt
    tl.to("#walker", { opacity: 0.45, duration: 0.2 }, D.bg[0]);
    tl.to("#walker", { opacity: 1, duration: 0.2 }, D.bg[1]);
    tl.to("#st-rec", { opacity: 0, duration: 0.15 }, D.bg[0]);
    tl.to("#st-bg", { opacity: 1, duration: 0.2 }, D.bg[0] + 0.1);
    tl.to("#st-bg", { opacity: 0, duration: 0.15 }, D.bg[1]);
    tl.to("#st-rec", { opacity: 1, duration: 0.2 }, D.bg[1] + 0.1);
    tl.to("#mk-end", { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" }, D.REC_END);

    // Uhr und Zähler: Funktion der Zeitleistenzeit
    const clockEl = document.querySelector("#clock");
    const countEl = document.querySelector("#count");
    const proxy = { v: 0 };
    tl.fromTo(proxy, { v: 0 }, {
      v: D.REVIEW, duration: D.REVIEW, ease: "none",
      onUpdate: () => {
        const v = proxy.v;
        const real = Math.max(0, Math.min(D.REC_END, v) - D.T0) * D.C;
        const c = D.clock0 + Math.floor(real);
        clockEl.textContent = [Math.floor(c / 3600), Math.floor(c / 60) % 60, c % 60].map((n) => String(n).padStart(2, "0")).join(":");
        countEl.textContent = "Gespeicherte Punkte: " + D.count.filter((t) => t <= v).length;
      },
    }, 0);

    // Session beenden: Tipp, dann Rückblick auf derselben Karte
    tl.fromTo("#tap", { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.45, ease: "expo.out" }, D.STOP_TAP);
    tl.fromTo("#stop-btn", { scale: 1 }, { scale: 0.94, duration: 0.08, yoyo: true, repeat: 1, ease: "power1.inOut" }, D.STOP_TAP);
    tl.to(["#rec-side .kicker", "#big-rec", "#st-rec", "#clock", "#clock-note", "#count", "#stop-btn"], { opacity: 0, filter: "blur(8px)", duration: 0.18, ease: "power2.in" }, D.REVIEW - 0.2);
    tl.to(["#walker", "#trail"], { opacity: 0, duration: 0.3, ease: "power2.in" }, D.REVIEW - 0.3);
    // Route spult zurück (alles verschwindet), dann wächst sie in der Wiedergabe neu
    tl.to([...D.lines.map((l) => "#casing-" + l.id), ...D.lines.map((l) => "#route-" + l.id)], { opacity: 0, duration: 0.3, ease: "power2.in" }, D.REVIEW);
    tl.to([...D.pts.map((_, i) => "#pt-" + i), ...D.ev.map((e) => "#ev-" + e.id), "#mk-end"], { opacity: 0, duration: 0.3, ease: "power2.in" }, D.REVIEW);
    tl.set(D.lines.flatMap((l) => ["#casing-" + l.id, "#route-" + l.id]), { opacity: 0, attr: { "stroke-dashoffset": (i, el) => el.getAttribute("stroke-dasharray") } }, D.REVIEW + 0.32);
    tl.fromTo("#big-rev .w", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power2.out", stagger: 0.067 }, D.REVIEW + 0.05);
    tl.fromTo(["#rev-side .kicker", "#controls"], { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out", stagger: 0.1 }, D.REVIEW + 0.3);
    tl.set(["#hl1", "#hl2"], { opacity: 0 }, 0);
    tl.set("#outro-line", { opacity: 0 }, 0);
    // Geschwindigkeit: erst 1×, dann 4×
    tl.set("#sp-1", { backgroundColor: "#7fd1c7", color: "#0b2a33" }, D.REVIEW);
    tl.set("#sp-1", { backgroundColor: "rgba(232, 244, 245, 0.1)", color: "#e8f4f5" }, D.FAST_AT);
    tl.set("#sp-4", { backgroundColor: "#7fd1c7", color: "#0b2a33" }, D.FAST_AT);
    tl.fromTo("#sp-4", { scale: 1 }, { scale: 1.12, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.inOut" }, D.FAST_AT);
    tl.fromTo("#bar-fill", { scaleX: 0 }, { keyframes: [{ scaleX: 0.2, duration: D.FAST_AT - D.PLAY, ease: "none" }, { scaleX: 1, duration: D.PLAY_END - D.FAST_AT, ease: "none" }] }, D.PLAY);
    // Wiedergabe: Kopf folgt den gespeicherten Punkten, Linien wachsen, Einträge erscheinen zu ihrem Zeitpunkt
    tl.set("#mk-start", { opacity: 0, scale: 0 }, D.REVIEW + 0.3);
    tl.to("#mk-start", { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.6)" }, D.PLAY - 0.2);
    tl.set("#head", { attr: { cx: D.head[0].x, cy: D.head[0].y } }, D.PLAY - 0.2);
    tl.to("#head", { opacity: 1, duration: 0.2 }, D.PLAY - 0.2);
    for (let i = 1; i < D.head.length; i++) {
      const a = D.head[i - 1], b = D.head[i];
      tl.to("#head", { attr: { cx: b.x, cy: b.y }, duration: Math.max(0.01, b.r - a.r), ease: "none" }, a.r);
    }
    D.lines.forEach((l) => {
      tl.set(["#casing-" + l.id, "#route-" + l.id], { opacity: 1 }, l.r0);
      tl.to(["#casing-" + l.id, "#route-" + l.id], { attr: { "stroke-dashoffset": 0 }, duration: Math.max(0.01, l.r1 - l.r0), ease: "none" }, l.r0);
    });
    D.ev.forEach((e) => tl.fromTo("#ev-" + e.id, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.8)", immediateRender: false }, e.r));
    tl.to("#head", { opacity: 0, duration: 0.2 }, D.PLAY_END);
    tl.to("#mk-end", { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" }, D.PLAY_END);
    // Highlights und Schlusszeile
    // Highlights in zwei Takten an derselben Stelle (Unschärfe-Tausch); die Wiedergabe-Steuerung macht Platz
    tl.to("#controls", { opacity: 0, filter: "blur(8px)", duration: 0.18, ease: "power2.in" }, D.HIGHLIGHTS - 0.2);
    tl.set("#hl1", { opacity: 1 }, D.HIGHLIGHTS);
    tl.fromTo(["#hl1 h3", "#hl1 .tile", "#hl1 .counts li"], { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out", stagger: 0.08 }, D.HIGHLIGHTS);
    tl.to("#hl1", { opacity: 0, filter: "blur(8px)", duration: 0.18, ease: "power2.in" }, D.H2 - 0.2);
    tl.set("#hl2", { opacity: 1 }, D.H2);
    tl.fromTo(["#hl2 h3", "#hl2 .tile", "#hl2 .moment"], { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out", stagger: 0.08 }, D.H2);
    tl.fromTo("#outro-line", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out", immediateRender: false }, D.OUTRO);
    tl.to({}, { duration: D.TOTAL }, 0);
    window.__timelines["route"] = tl;
  </script>
</template>
`;

const index = `<!doctype html>
<!-- Fangpunkt – Funktionsanimation „Session-Rückblick mit GPS-Route“ (SPEC.md), 1920 × 1080, 30 fps.
     NICHT VON HAND ÄNDERN: erzeugt von build.mjs. -->
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #0b2a33; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080">
      <div id="route" data-composition-id="route" data-composition-src="compositions/route.html" data-start="0" data-duration="${ROUTE_END}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>
      <audio id="music" class="clip" src="assets/music/music-route.wav" data-start="0" data-duration="${TOTAL}" data-track-index="10" data-volume="0.22" data-audio-group="music"></audio>
${events.map((e, i) => `      <audio id="sfx-ev-${i}" class="clip" src="assets/graphics/sfx-tap.wav" data-start="${vt(e.t)}" data-duration="0.06" data-track-index="${11 + i}" data-volume="0.45" data-audio-group="sfx"></audio>`).join('\n')}
${events.map((e, i) => `      <audio id="sfx-rev-${i}" class="clip" src="assets/graphics/sfx-tap.wav" data-start="${replayT(e.t)}" data-duration="0.06" data-track-index="${14 + i}" data-volume="0.45" data-audio-group="sfx"></audio>`).join('\n')}
      <div id="phone" data-composition-id="phone" data-composition-src="compositions/phone.html" data-start="${PHONE}" data-duration="${PHONE_DUR}" data-track-index="2" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index: 2"></div>
${reviewRec.taps.map((p, i) => `      <audio id="sfx-ph-${i}" class="clip" src="assets/graphics/sfx-tap.wav" data-start="${fx(PHONE + 0.5 + p.t)}" data-duration="0.06" data-track-index="${20 + i}" data-volume="0.45" data-audio-group="sfx"></audio>`).join('\n')}
      <audio id="sfx-stop" class="clip" src="assets/graphics/sfx-tap.wav" data-start="${STOP_TAP}" data-duration="0.06" data-track-index="17" data-volume="0.5" data-audio-group="sfx"></audio>
      <audio id="sfx-review" class="clip" src="assets/graphics/sfx-whoosh.wav" data-start="${fx(REVIEW - 0.25)}" data-duration="0.7" data-track-index="18" data-volume="0.3" data-audio-group="sfx"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
mkdirSync(new URL('compositions/', here), { recursive: true });
writeFileSync(new URL('compositions/route.html', here), html);
writeFileSync(new URL('index.html', here), index);
writeFileSync(new URL('compositions/phone.html', here), phoneHtml());
const summary = [
  `Gesamt ${TOTAL} s · Session ${REAL_END.toFixed(0)} s echt (${minutes} min), Zeitraffer ×${C}`,
  `Weg ${fx(L * M_PER_PX, 0)} m, gespeicherte Route ${fx(distM, 0)} m (${km} km), ${points.length} Punkte in ${segments.length} Abschnitten`,
  `Verworfen gezeigt: ${shown.map((r) => r.why).join(', ')}`,
  `Handy mit echtem Rückblick ab ${PHONE} s (${PHONE_DUR} s)`,
  `Rückblick ab ${REVIEW} s, Wiedergabe ${PLAY}–${PLAY_END} s (4× ab ${FAST_AT} s), Highlights ${HIGHLIGHTS} s, Schluss ${OUTRO} s`,
];
writeFileSync(new URL('timing.txt', here), summary.join('\n') + '\n');
console.log(summary.join('\n'));

// Schluss-Szene: Handy mit der echten Aufnahme „Session beenden“ → „Dein Angeltrip im Rückblick“
function phoneHtml() {
  const k = 483.6 / 393;
  const LEAD = 0.5; // Aufnahme startet kurz nach der Blende
  const steps = [
    { t: 0.6, text: 'Session beenden antippen' },
    { t: 3.0, text: 'Route abspielen – hier mit 4×' },
    { t: 9.2, text: 'Deine Highlights' },
    { t: 13.4, text: 'Fang-Highlights und Besondere Momente' },
  ];
  const rings = reviewRec.taps
    .map((p, i) => `<div id="ph-tap-${i}" class="tap clip" data-start="${fx(LEAD + p.t, 3)}" data-duration="0.5" data-track-index="${5 + i}" style="left:${fx(18.2 + p.x * k, 1)}px;top:${fx(18.2 + 66.4 + p.y * k, 1)}px"><i class="dot"></i><i class="ring"></i></div>`)
    .join('\n        ');
  const stepEls = steps.map((st, i) => `<li id="st-${i}"><span class="n">${i + 1}</span>${st.text}</li>`).join('\n        ');
  return `<template>
  <style>
    @font-face { font-family: "Fraunces Variable"; font-weight: 100 900; src: url("assets/fonts/fraunces-latin-wght-normal.woff2") format("woff2-variations"); }
    @font-face { font-family: "Fraunces Variable"; font-weight: 100 900; src: url("assets/fonts/fraunces-latin-ext-wght-normal.woff2") format("woff2-variations"); unicode-range: U+0100-024F; }
    @font-face { font-family: "Inter Variable"; font-weight: 100 900; src: url("assets/fonts/inter-latin-wght-normal.woff2") format("woff2-variations"); }
    @font-face { font-family: "Inter Variable"; font-weight: 100 900; src: url("assets/fonts/inter-latin-ext-wght-normal.woff2") format("woff2-variations"); unicode-range: U+0100-024F; }
    #root { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(55% 60% at 70% 50%, #12404b 0%, rgba(11, 42, 51, 0) 100%), #0b2a33; font-family: "Inter Variable", Inter, sans-serif; }
    #ph-fade { position: absolute; inset: 0; }
    .kicker { position: absolute; left: 160px; top: 230px; font: 650 28px "Inter Variable", Inter, sans-serif; letter-spacing: 3px; color: #5cc4d6; }
    .big { position: absolute; left: 160px; top: 280px; width: 860px; font-family: "Fraunces Variable", Georgia, serif; font-weight: 640; font-size: 76px; line-height: 1.1; color: #fff; }
    .big .w { display: inline-block; }
    .big .accent { color: #7fd1c7; }
    #steps { position: absolute; left: 160px; top: 500px; list-style: none; font: 600 34px "Inter Variable", Inter, sans-serif; color: rgba(232, 244, 245, 0.45); }
    #steps li { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
    #steps .n { width: 52px; height: 52px; border-radius: 50%; background: rgba(232, 244, 245, 0.12); color: #e8f4f5; font: 700 28px/52px "Inter Variable", Inter, sans-serif; text-align: center; }
    #note { position: absolute; left: 160px; top: 880px; width: 860px; font: 500 28px/1.4 "Inter Variable", Inter, sans-serif; color: rgba(232, 244, 245, 0.7); }
    /* Handy wie in den anderen Videos (520 px breit), für das Querformat auf 86 % verkleinert; es steht still */
    #ph-wrap { position: absolute; left: 1160px; top: 73px; width: 520px; height: 1085px; transform: scale(0.86); transform-origin: 0 0; }
    #ph { position: absolute; inset: 0; padding: 18.2px; border-radius: 80px; background: linear-gradient(145deg, #3a4246, #15191b 45%, #2b3236); box-shadow: 0 40px 90px rgba(0, 0, 0, 0.45), 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 0 0 2px rgba(255, 255, 255, 0.08); }
    .screen { position: relative; width: 483.6px; height: 1048.4px; border-radius: 65px; overflow: hidden; background: #fff; }
    .status { position: absolute; left: 0; top: 0; width: 100%; height: 66.4px; background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 7px 42px 0; font: 600 21px "Inter Variable", Inter, sans-serif; color: #000; z-index: 3; }
    .status svg { fill: #000; }
    .island { position: absolute; top: 13.5px; left: 165.5px; width: 152.6px; height: 44.3px; border-radius: 22px; background: #000; z-index: 4; }
    #rec, #rec-hold { position: absolute; left: 0; top: 66.4px; width: 483.6px; height: 982px; object-fit: cover; object-position: top; }
    .tap { position: absolute; width: 0; height: 0; }
    .tap i { position: absolute; border-radius: 50%; }
    .tap .ring { left: -45px; top: -45px; width: 90px; height: 90px; border: 3px solid #fff; box-shadow: 0 0 0 1.5px rgba(11, 42, 51, 0.55), inset 0 0 0 1.5px rgba(11, 42, 51, 0.55); }
    .tap .dot { left: -23px; top: -23px; width: 46px; height: 46px; background: rgba(11, 42, 51, 0.28); border: 2px solid rgba(255, 255, 255, 0.9); }
  </style>
  <div id="root" data-composition-id="phone" data-width="1920" data-height="1080">
    <div id="ph-fade">
      <div class="kicker">IN DER APP</div>
      <h2 class="big"><span class="w">So</span> <span class="w">sieht</span> <span class="w">dein</span> <span class="w accent">Rückblick</span> <span class="w">aus.</span></h2>
      <ol id="steps">
        ${stepEls}
      </ol>
      <p id="note" data-layout-ignore>Echte Aufnahme der App mit Beispieldaten · Karte: OpenFreeMap © OpenMapTiles, Daten © OpenStreetMap-Mitwirkende</p>
      <div id="ph-wrap" data-layout-allow-overflow>
        <div id="ph">
          <div class="screen">
            <div class="status" data-layout-ignore><span>9:41</span><svg width="84" height="17" viewBox="0 0 70 14"><rect x="0" y="10" width="3.4" height="4" rx="0.8"/><rect x="5" y="7" width="3.4" height="7" rx="0.8"/><rect x="10" y="4" width="3.4" height="10" rx="0.8"/><rect x="15" y="1" width="3.4" height="13" rx="0.8"/><path d="M28 5.2a10 10 0 0 1 14 0l-1.6 1.6a7.6 7.6 0 0 0-10.8 0zM31.4 8.6a5.2 5.2 0 0 1 7.2 0L35 12.2z"/><rect x="46" y="1.5" width="21" height="11" rx="3" fill="none" stroke="#000" stroke-opacity="0.4"/><rect x="48" y="3.5" width="15" height="7" rx="1.6"/><rect x="68" y="5" width="1.6" height="4" rx="0.6" fill-opacity="0.4"/></svg></div>
            <div class="island"></div>
            <video id="rec" class="clip" src="assets/tutorial/review.mp4" data-start="${LEAD}" data-duration="${fx(reviewRec.durationS)}" data-media-start="0" data-track-index="2" muted playsinline></video>
            <img id="rec-hold" class="clip" src="assets/tutorial/review-last.png" data-start="${fx(LEAD + reviewRec.durationS)}" data-duration="${fx(PHONE_DUR - LEAD - reviewRec.durationS)}" data-track-index="3" alt="" />
          </div>
        </div>
        ${rings}
      </div>
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#ph-fade", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.inOut" }, 0);
    tl.fromTo(".big .w", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.13, ease: "power2.out", stagger: 0.067 }, 0.3);
    tl.fromTo([".kicker", "#steps li", "#note"], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", stagger: 0.06 }, 0.5);
    // der gerade gezeigte Schritt leuchtet auf, die anderen bleiben gedämpft
    const steps = ${JSON.stringify(steps.map((st) => fx(LEAD + st.t, 3)))};
    steps.forEach((t, i) => {
      tl.to("#st-" + i, { color: "#ffffff", duration: 0.2, ease: "power2.out" }, t);
      tl.to("#st-" + i + " .n", { backgroundColor: "#f2994a", color: "#0b2a33", duration: 0.2, ease: "power2.out" }, t);
      if (i < steps.length - 1) {
        tl.to("#st-" + i, { color: "rgba(232, 244, 245, 0.45)", duration: 0.2 }, steps[i + 1]);
        tl.to("#st-" + i + " .n", { backgroundColor: "rgba(232, 244, 245, 0.12)", color: "#e8f4f5", duration: 0.2 }, steps[i + 1]);
      }
    });
    ${JSON.stringify(reviewRec.taps.map((p) => fx(LEAD + p.t, 3)))}.forEach((t, i) => {
      tl.fromTo("#ph-tap-" + i + " .dot", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.08, ease: "power2.out" }, t);
      tl.to("#ph-tap-" + i + " .dot", { opacity: 0, duration: 0.25, ease: "power2.in" }, t + 0.18);
      tl.fromTo("#ph-tap-" + i + " .ring", { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.45, ease: "expo.out" }, t);
    });
    tl.to({}, { duration: ${PHONE_DUR} }, 0);
    window.__timelines["phone"] = tl;
  </script>
</template>
`;
}

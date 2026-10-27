// Zeichnungen der Montagen (eigene Darstellung, schematisch: Abstände vergrößert). Koordinaten im Raster der
// viewBox; Teile liegen in der Reihenfolge der Liste übereinander (siehe domain/rigs.ts). Die Rute liegt rechts
// bzw. oben, der Haken links bzw. unten. Beschriftungen: Schlüssel aus de.rigs.parts.
import type { RigDiagramSpec, RigPart, RigStyle } from '../../domain/rigs';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ellipse als geschlossener Bézier-Pfad */
function ellipse(cx: number, cy: number, rx: number, ry = rx): string {
  const kx = 0.5523 * rx;
  const ky = 0.5523 * ry;
  return (
    `M${r1(cx)} ${r1(cy - ry)} C${r1(cx + kx)} ${r1(cy - ry)} ${r1(cx + rx)} ${r1(cy - ky)} ${r1(cx + rx)} ${r1(cy)} ` +
    `C${r1(cx + rx)} ${r1(cy + ky)} ${r1(cx + kx)} ${r1(cy + ry)} ${r1(cx)} ${r1(cy + ry)} ` +
    `C${r1(cx - kx)} ${r1(cy + ry)} ${r1(cx - rx)} ${r1(cy + ky)} ${r1(cx - rx)} ${r1(cy)} ` +
    `C${r1(cx - rx)} ${r1(cy - ky)} ${r1(cx - kx)} ${r1(cy - ry)} ${r1(cx)} ${r1(cy - ry)} Z`
  );
}

/** Patronenblei, Spitze nach rechts (zur Rute) */
const bullet = (x: number, y: number) =>
  `M${x + 15} ${y} C${x + 9} ${y - 8} ${x + 1} ${y - 9} ${x - 15} ${y - 8} L${x - 15} ${y + 8} ` +
  `C${x + 1} ${y + 9} ${x + 9} ${y + 8} ${x + 15} ${y} Z`;

/** Tropfenblei, hängt mit der Spitze nach oben an (x, top) */
const drop = (x: number, top: number, h: number, r: number) =>
  `M${x} ${top} C${x + 3} ${top + h * 0.35} ${x + r} ${top + h - 2 * r} ${x + r} ${top + h - r} ` +
  `C${x + r} ${top + h - r * 0.45} ${x + r * 0.55} ${top + h} ${x} ${top + h} ` +
  `C${x - r * 0.55} ${top + h} ${x - r} ${top + h - r * 0.45} ${x - r} ${top + h - r} ` +
  `C${x - r} ${top + h - 2 * r} ${x - 3} ${top + h * 0.35} ${x} ${top} Z`;

type Map2 = (a: number, b: number) => [number, number];
/** Koordinaten entlang einer Richtung: a = Abstand vom Öhr, b = quer dazu (Seite der Hakenspitze) */
const along = (ex: number, ey: number, dir: 'left' | 'down', k = 1): Map2 =>
  dir === 'left' ? (a, b) => [r1(ex - a * k), r1(ey + b * k)] : (a, b) => [r1(ex - b * k), r1(ey + a * k)];

const pts = (m: Map2, ...ab: [number, number][]) => ab.map(([a, b]) => m(a, b).join(' ')).join(' ');

/** Haken mit Öhr bei (ex, ey); offset: Knick hinter dem Öhr (Offsethaken) */
function hook(
  ex: number,
  ey: number,
  dir: 'left' | 'down',
  o: { offset?: boolean; k?: number } = {},
): string {
  const k = o.k ?? 1;
  const m = along(ex, ey, dir, k);
  const s = o.offset ? 7 : 0;
  const L = 44;
  const g = 26;
  const eyeRing = ellipse(ex, ey, 3.5 * k);
  let d = `${eyeRing} M${pts(m, [3.5, 0])}`;
  if (o.offset) d += ` L${pts(m, [8, 0])} C${pts(m, [12, 0], [12, s], [16, s])}`;
  d += ` L${pts(m, [L, s])} C${pts(m, [L + 18, s], [L + 18, s + g], [L - 2, s + g])}`;
  d += ` C${pts(m, [L - 10, s + g], [L - 14, s + g - 6], [L - 16, s + g - 14])}`;
  return d;
}

/** Gummiwurm, texanisch auf einem Offsethaken (Öhr bei ex, ey, nach links); die Spitze steckt im Körper */
const softWorm = (ex: number, ey: number) =>
  `M${ex - 6} ${ey + 7} C${ex - 6} ${ey} ${ex - 10} ${ey - 1} ${ex - 16} ${ey - 1} L${ex - 60} ${ey} ` +
  `C${ex - 72} ${ey} ${ex - 80} ${ey + 2} ${ex - 88} ${ey - 4} C${ex - 90} ${ey} ${ex - 86} ${ey + 8} ${ex - 78} ${ey + 10} ` +
  `L${ex - 60} ${ey + 14} C${ex - 48} ${ey + 16} ${ex - 40} ${ey + 24} ${ex - 30} ${ey + 23} ` +
  `C${ex - 22} ${ey + 22} ${ex - 20} ${ey + 15} ${ex - 16} ${ey + 15} C${ex - 10} ${ey + 15} ${ex - 6} ${ey + 13} ${ex - 6} ${ey + 7} Z`;

/** Wirbel: zwei Ringe und Körper; waagerecht (Ringe bei x ± 12) oder senkrecht (y ± 12) */
function swivel(
  id: string,
  step: number,
  x: number,
  y: number,
  dir: 'h' | 'v',
  label?: RigPart['label'],
): RigPart[] {
  const [a, b] =
    dir === 'h'
      ? [ellipse(x - 12, y, 4), ellipse(x + 12, y, 4)]
      : [ellipse(x, y - 12, 4), ellipse(x, y + 12, 4)];
  const body =
    dir === 'h'
      ? `M${x - 5} ${y - 4.5} L${x + 5} ${y - 4.5} C${x + 9} ${y - 4.5} ${x + 9} ${y + 4.5} ${x + 5} ${y + 4.5} ` +
        `L${x - 5} ${y + 4.5} C${x - 9} ${y + 4.5} ${x - 9} ${y - 4.5} ${x - 5} ${y - 4.5} Z`
      : `M${x - 4.5} ${y - 5} L${x - 4.5} ${y + 5} C${x - 4.5} ${y + 9} ${x + 4.5} ${y + 9} ${x + 4.5} ${y + 5} ` +
        `L${x + 4.5} ${y - 5} C${x + 4.5} ${y - 9} ${x - 4.5} ${y - 9} ${x - 4.5} ${y - 5} Z`;
  return [
    { id: `${id}Rings`, step, style: 'hardware', d: `${a} ${b}` },
    { id, step, style: 'metal', d: body, ...(label ? { label } : {}) },
  ];
}

const part = (id: string, step: number, style: RigStyle, d: string, label?: RigPart['label']): RigPart =>
  label ? { id, step, style, d, label } : { id, step, style, d };

/** Hauptschnur von rechts oben, fällt zum Grund ab und läuft waagerecht bis x */
const mainLine = (y: number, toX: number) => `M392 30 C352 30 346 ${y} 314 ${y} L${toX} ${y}`;
const MAIN_LABEL = { key: 'main', x: 388, y: 20, anchor: 'end' } as const;

export const carolinaDiagram: RigDiagramSpec = {
  width: 400,
  height: 190,
  parts: [
    part('ground', 0, 'context', 'M8 140 L392 140', { key: 'ground', x: 392, y: 160, anchor: 'end' }),
    part('line', 0, 'line', mainLine(130, 224), MAIN_LABEL),
    part('weight', 0, 'weight', bullet(296, 130), { key: 'bulletWeight', x: 296, y: 160 }),
    part('bead', 1, 'bead', ellipse(252, 130, 6), { key: 'bead', x: 252, y: 178 }),
    ...swivel('swivel', 2, 208, 130, 'h', { key: 'swivel', x: 208, y: 160 }),
    part('leader', 3, 'line2', 'M192 130 C150 130 140 84 104 84', { key: 'leader', x: 150, y: 160 }),
    part('hook', 3, 'hardware', hook(100, 84, 'left', { offset: true }), {
      key: 'offsetHook',
      x: 118,
      y: 64,
      anchor: 'start',
    }),
    part('bait', 4, 'bait', softWorm(100, 84), { key: 'softBait', x: 10, y: 70, anchor: 'start' }),
  ],
};

export const texasDiagram: RigDiagramSpec = {
  width: 400,
  height: 186,
  parts: [
    part('line', 0, 'line', mainLine(110, 210), MAIN_LABEL),
    part('weight', 0, 'weight', bullet(272, 110), { key: 'bulletWeight', x: 272, y: 160 }),
    part('bead', 1, 'bead', ellipse(236, 110, 6), { key: 'beadOptional', x: 236, y: 178 }),
    part('hook', 2, 'hardware', hook(206, 110, 'left', { offset: true }), {
      key: 'offsetHook',
      x: 168,
      y: 160,
    }),
    part('bait', 3, 'bait', softWorm(206, 110), { key: 'softBait', x: 150, y: 98 }),
  ],
};

export const dropShotDiagram: RigDiagramSpec = {
  width: 400,
  height: 262,
  parts: [
    part('ground', 0, 'context', 'M8 240 L392 240', { key: 'ground', x: 392, y: 256, anchor: 'end' }),
    part('line', 0, 'line', 'M250 6 L250 92.5', { key: 'main', x: 262, y: 22, anchor: 'start' }),
    part('hook', 0, 'hardware', hook(250, 96, 'left'), {
      key: 'palomarHook',
      x: 262,
      y: 100,
      anchor: 'start',
    }),
    part('tag', 1, 'line', 'M250 99.5 L250 210', { key: 'dropDistance', x: 262, y: 160, anchor: 'start' }),
    part('weight', 2, 'weight', drop(250, 210, 28, 9), {
      key: 'dropShotWeight',
      x: 264,
      y: 232,
      anchor: 'start',
    }),
    part(
      'bait',
      3,
      'bait',
      'M228 108 C228 100 220 98 210 98 L160 100 L146 92 L139 94 L145 107 L139 120 L146 122 L160 114 ' +
        'L210 117 C220 117 228 115 228 108 Z',
      { key: 'softBait', x: 160, y: 84 },
    ),
  ],
};

export const freeRigDiagram: RigDiagramSpec = {
  width: 400,
  height: 190,
  parts: [
    part('ground', 0, 'context', 'M8 150 L392 150', { key: 'ground', x: 392, y: 168, anchor: 'end' }),
    part('line', 0, 'line', mainLine(110, 170), MAIN_LABEL),
    part('weightEye', 0, 'hardware', ellipse(280, 112, 5)),
    part('weight', 0, 'weight', drop(280, 117, 32, 10), { key: 'dropWeight', x: 280, y: 168 }),
    part('bead', 1, 'bead', ellipse(226, 110, 6), { key: 'bead', x: 226, y: 186 }),
    part('hook', 2, 'hardware', hook(166, 110, 'left', { offset: true }), {
      key: 'offsetHook',
      x: 166,
      y: 168,
    }),
    part('bait', 3, 'bait', softWorm(166, 110), { key: 'softBait', x: 110, y: 96 }),
  ],
};

/** Tauwurm auf dem Haken (Strich), die Spitze bleibt frei */
function worm(ex: number, ey: number, dir: 'left' | 'down', k = 1): string {
  const m = along(ex, ey, dir, k);
  return (
    `M${pts(m, [8, 0])} L${pts(m, [44, 0])} C${pts(m, [62, 0], [62, 20], [52, 24])} ` +
    `C${pts(m, [60, 34], [72, 26], [80, 30])} C${pts(m, [88, 34], [96, 28], [104, 30])}`
  );
}

export const runningLedgerDiagram: RigDiagramSpec = {
  width: 400,
  height: 192,
  parts: [
    part('ground', 0, 'context', 'M8 150 L392 150', { key: 'ground', x: 392, y: 170, anchor: 'end' }),
    part('line', 0, 'line', mainLine(138, 232), MAIN_LABEL),
    part('weight', 0, 'weight', ellipse(296, 138, 16, 9), { key: 'runningWeight', x: 296, y: 170 }),
    part('bead', 1, 'bead', ellipse(256, 138, 6), { key: 'bead', x: 256, y: 188 }),
    ...swivel('swivel', 2, 216, 138, 'h', { key: 'swivel', x: 216, y: 170 }),
    part('leader', 3, 'line2', 'M200 138 C170 138 150 112 117.5 112', { key: 'leader', x: 160, y: 170 }),
    part('hook', 3, 'hardware', hook(114, 112, 'left'), { key: 'hook', x: 114, y: 94 }),
    part('bait', 4, 'worm', worm(114, 112, 'left'), { key: 'worm', x: 8, y: 170, anchor: 'start' }),
  ],
};

/** Pose: Antenne mit farbiger Spitze, Körper, Kiel; senkrecht bei x */
function floatBody(x: number, top: number): string {
  return (
    `M${x - 2} ${top} L${x + 2} ${top} L${x + 2} ${top + 22} C${x + 9} ${top + 30} ${x + 11} ${top + 48} ${x + 8} ${top + 60} ` +
    `C${x + 6} ${top + 68} ${x + 3} ${top + 72} ${x + 1.5} ${top + 74} L${x + 1.5} ${top + 82} L${x - 1.5} ${top + 82} ` +
    `L${x - 1.5} ${top + 74} C${x - 3} ${top + 72} ${x - 6} ${top + 68} ${x - 8} ${top + 60} ` +
    `C${x - 11} ${top + 48} ${x - 9} ${top + 30} ${x - 2} ${top + 22} Z`
  );
}
const floatTip = (x: number, top: number) =>
  `M${x - 2} ${top} L${x + 2} ${top} L${x + 2} ${top + 12} L${x - 2} ${top + 12} Z`;

export const fixedFloatDiagram: RigDiagramSpec = {
  width: 400,
  height: 302,
  parts: [
    part('surface', 0, 'context', 'M8 50 L392 50', { key: 'surface', x: 12, y: 42, anchor: 'start' }),
    part('ground', 0, 'context', 'M8 284 L392 284', { key: 'ground', x: 12, y: 298, anchor: 'start' }),
    part('line', 0, 'line', 'M392 8 C320 10 230 30 200 58 L200 126', {
      key: 'main',
      x: 388,
      y: 40,
      anchor: 'end',
    }),
    part('float', 0, 'float', floatBody(200, 30), { key: 'float', x: 184, y: 92, anchor: 'end' }),
    part('floatTip', 0, 'floatTip', floatTip(200, 30)),
    part('rubbers', 0, 'stopper', 'M194 60 L206 60 M195 108 L205 108', {
      key: 'floatRubbers',
      x: 216,
      y: 112,
      anchor: 'start',
    }),
    part('line2', 1, 'line', 'M200 126 L200 200'),
    part(
      'shots',
      1,
      'weight',
      `${ellipse(200, 146, 5)} ${ellipse(200, 158, 5)} ${ellipse(200, 170, 5)} ${ellipse(200, 192, 3.5)}`,
      { key: 'shots', x: 216, y: 164, anchor: 'start' },
    ),
    part('leader', 2, 'line2', 'M200 200 L200 216', { key: 'leader', x: 216, y: 212, anchor: 'start' }),
    part('hook', 2, 'hardware', hook(200, 219, 'down', { k: 0.8 }), {
      key: 'hook',
      x: 172,
      y: 262,
      anchor: 'end',
    }),
    part('bait', 3, 'bait', `${ellipse(190, 248, 3, 6.5)} ${ellipse(183, 243, 6.5, 3)}`, {
      key: 'maggots',
      x: 216,
      y: 254,
      anchor: 'start',
    }),
  ],
};

export const slidingFloatDiagram: RigDiagramSpec = {
  width: 400,
  height: 326,
  parts: [
    part('surface', 0, 'context', 'M8 50 L392 50', { key: 'surface', x: 12, y: 42, anchor: 'start' }),
    part('line', 0, 'line', 'M392 12 L203.5 101 C201 103 200 105 200 107 L200 168', {
      key: 'main',
      x: 392,
      y: 72,
      anchor: 'end',
    }),
    part('stopper', 0, 'stopper', 'M235 81.4 L245 86.1 M238 82.8 L235 74 M242 84.7 L246 76', {
      key: 'stopper',
      x: 252,
      y: 104,
      anchor: 'start',
    }),
    part('bead', 1, 'bead', ellipse(222, 92.3, 5), { key: 'bead', x: 214, y: 118, anchor: 'start' }),
    part('float', 1, 'float', floatBody(200, 22), { key: 'slidingFloat', x: 184, y: 72, anchor: 'end' }),
    part('floatTip', 1, 'floatTip', floatTip(200, 22)),
    part('floatEye', 1, 'hardware', ellipse(200, 103, 3.5)),
    part('weight', 2, 'weight', ellipse(200, 138, 7, 14), {
      key: 'oliveWeight',
      x: 214,
      y: 143,
      anchor: 'start',
    }),
    part('bead2', 2, 'bead', ellipse(200, 160, 5)),
    ...swivel('swivel', 2, 200, 184, 'v', { key: 'swivel', x: 214, y: 188, anchor: 'start' }),
    part('leader', 3, 'line2', 'M200 200 L200 236', { key: 'leader', x: 214, y: 222, anchor: 'start' }),
    part('hook', 3, 'hardware', hook(200, 239.5, 'down', { k: 0.75 }), {
      key: 'hook',
      x: 176,
      y: 262,
      anchor: 'end',
    }),
    part('bait', 4, 'worm', worm(200, 239.5, 'down', 0.75), {
      key: 'baitExample',
      x: 214,
      y: 280,
      anchor: 'start',
    }),
  ],
};

export const hairRigDiagram: RigDiagramSpec = {
  width: 400,
  height: 192,
  parts: [
    part('ground', 0, 'context', 'M8 154 L392 154', { key: 'ground', x: 392, y: 172, anchor: 'end' }),
    part('line', 0, 'line', mainLine(140, 290), MAIN_LABEL),
    part('weight', 0, 'weight', ellipse(264, 140, 26, 12), { key: 'fixedWeight', x: 264, y: 172 }),
    part('hook', 1, 'hardware', hook(146, 118, 'left'), { key: 'carpHook', x: 146, y: 98 }),
    part('hair', 1, 'line2', 'M106 121 C100 128 94 134 88 138', { key: 'hair', x: 58, y: 118 }),
    part('leader', 2, 'line2', 'M238 140 C200 140 180 118 149.5 118', {
      key: 'leaderKnotless',
      x: 238,
      y: 190,
    }),
    part('wraps', 2, 'line2', 'M138 113 L132 123 M130 113 L124 123 M122 113 L116 123'),
    part('stop', 3, 'stopper', 'M71 147 L77 153'),
    part('boilie', 3, 'bait', ellipse(82, 143, 9), { key: 'boilie', x: 8, y: 182, anchor: 'start' }),
  ],
};

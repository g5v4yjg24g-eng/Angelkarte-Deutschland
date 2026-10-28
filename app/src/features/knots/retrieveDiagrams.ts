// Zeichnungen der Köderführung (eigene, schematische Darstellung): Seitenansicht, der Angler steht rechts am Ufer
// (beim Vertikalangeln im Boot). Die Bahn (`trail`) zeigt, wie sich der Köder bewegt; ein Köder läuft sie ab, die Rute
// bewegt sich dazu (`rod`, Winkel über der Waagerechten), die Schnur führt von der Rutenspitze zum Köder.
// `ms` gibt jeder Bewegung ihr Tempo. Beschriftungen: Schlüssel aus de.retrieves.labels.
// Die Wasser-Koordinaten sind in einem Raster mit der Oberfläche bei y = 24 geschrieben; `scene` schiebt alles um
// OY nach unten, damit über dem Wasser Platz für Angler und Rute ist.
import type { AnglerSpec, RodMove } from '../../domain/angler';
import type { RigDiagramSpec, RigPart } from '../../domain/rigs';

const W = 400;
const H = 236;
const OY = 100;

/** Alle y-Werte eines Pfads verschieben (Pfade nur aus M, L, C, Q, Z mit Koordinatenpaaren) */
function shiftY(d: string, dy: number): string {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (n) => (i++ % 2 === 1 ? String(Number(n) + dy) : n));
}

function ring(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  return (
    `M${cx} ${cy - r} C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} ` +
    `C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} ` +
    `C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} ` +
    `C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}`
  );
}

/** Strichfigur: Füße bei (x, feet), Hand am Rutengriff links vor dem Körper */
function anglerFigure(x: number, feet: number): { part: RigPart; hand: [number, number] } {
  const hip = feet - 24;
  const shoulder = hip - 20;
  const hand: [number, number] = [x - 12, shoulder + 18];
  const d =
    `M${x - 6} ${feet} L${x} ${hip} L${x + 6} ${feet} M${x} ${hip} L${x} ${shoulder} ` +
    `M${x} ${shoulder + 4} L${hand[0]} ${hand[1]} ${ring(x, shoulder - 9, 7)}`;
  return { part: { id: 'anglerFigure', step: 0, style: 'angler', ms: 1, d }, hand };
}

/** Wasser-Raster nach unten schieben, Ufer (oder Boot) mit Angler und Rute ergänzen */
function scene(
  parts: RigPart[],
  rod: { base: number; length?: number; line?: boolean; boat?: boolean },
): RigDiagramSpec {
  // Kulisse (Wasser, Ufer, Angler) erscheint sofort, die Zeit gehört den Bewegungen
  const shifted = parts.map((p) => ({
    ...p,
    ...(p.style === 'trail' ? {} : { ms: 1 }),
    d: shiftY(p.d, OY),
    ...(p.label ? { label: { ...p.label, y: p.label.y + OY } } : {}),
  }));
  const figure = rod.boat ? anglerFigure(226, 24 + OY) : anglerFigure(384, OY);
  const extra: RigPart[] = rod.boat
    ? [figure.part]
    : [
        {
          id: 'bank',
          step: 0,
          style: 'bank',
          ms: 1,
          d: `M352 ${206 + OY} L366 ${OY} L400 ${OY} L400 ${206 + OY} Z`,
        },
        figure.part,
      ];
  const angler: AnglerSpec = {
    hand: figure.hand,
    length: rod.length ?? 70,
    base: rod.base,
    ...(rod.line === false ? { line: false } : { line: true }),
  };
  return { width: W, height: H + OY, lure: true, angler, parts: [...extra, ...shifted] };
}

const water: RigPart[] = [
  {
    id: 'surface',
    step: 0,
    style: 'context',
    d: 'M8 24 L392 24',
    label: { key: 'surface', x: 12, y: 18, anchor: 'start' },
  },
  {
    id: 'ground',
    step: 0,
    style: 'context',
    d: 'M8 206 L392 206',
    label: { key: 'ground', x: 346, y: 224, anchor: 'end' },
  },
];
const trail = (
  id: string,
  step: number,
  d: string,
  ms: number,
  rod: RodMove,
  label?: RigPart['label'],
): RigPart => ({ id, step, style: 'trail', d, ms, rod, ...(label ? { label } : {}) });
const hold = (a: number, more: Partial<RodMove> = {}): RodMove => ({
  keys: [
    [0, a],
    [1, a],
  ],
  ...more,
});
const move = (a: number, b: number, more: Partial<RodMove> = {}): RodMove => ({
  keys: [
    [0, a],
    [1, b],
  ],
  ...more,
});
/** n kurze Schläge zwischen a und b */
const flicks = (a: number, b: number, n: number, more: Partial<RodMove> = {}): RodMove => ({
  keys: Array.from({ length: 2 * n + 1 }, (_, i) => [i / (2 * n), i % 2 ? b : a] as const),
  ...more,
});
const sink = (a: number) =>
  trail('sink', 0, 'M30 40 C40 90 50 160 60 200', 1400, hold(a, { slack: true }), {
    key: 'sink',
    x: 72,
    y: 90,
    anchor: 'start',
  });

export const jigDiagram = scene(
  [
    ...water,
    sink(30),
    trail('hop', 1, 'M60 200 C66 160 84 140 100 140', 450, move(30, 65), {
      key: 'jerkUp',
      x: 108,
      y: 128,
      anchor: 'start',
    }),
    trail('fall', 2, 'M100 140 C112 140 124 170 132 200', 1100, move(65, 30, { reel: true }), {
      key: 'fallBite',
      x: 132,
      y: 224,
    }),
    trail(
      'again',
      3,
      'M132 200 C138 160 156 140 172 140 C184 140 196 170 204 200 C210 160 228 140 244 140 C256 140 268 170 276 200',
      2400,
      {
        keys: [
          [0, 30],
          [0.2, 65],
          [0.5, 30],
          [0.7, 65],
          [1, 30],
        ],
        reel: true,
      },
      { key: 'repeat', x: 300, y: 128, anchor: 'start' },
    ),
  ],
  { base: 30 },
);

export const faulenzenDiagram = scene(
  [
    ...water,
    sink(45),
    trail('reel', 1, 'M60 200 C70 185 90 168 120 166', 700, hold(45, { reel: true }), {
      key: 'turns',
      x: 70,
      y: 150,
      anchor: 'start',
    }),
    trail('fall', 2, 'M120 166 C134 166 146 184 152 200', 1000, hold(45), {
      key: 'stopFall',
      x: 152,
      y: 224,
    }),
    trail(
      'again',
      3,
      'M152 200 C162 185 182 168 212 166 C226 166 238 184 244 200 C254 185 274 168 304 166 C318 166 330 184 336 200',
      2600,
      hold(45, { reel: true }),
      { key: 'repeat', x: 274, y: 150 },
    ),
  ],
  { base: 45 },
);

export const steadyDiagram = scene(
  [
    ...water,
    trail('dive', 0, 'M30 40 C40 80 52 108 70 112', 1000, hold(25, { reel: true }), {
      key: 'toDepth',
      x: 80,
      y: 76,
      anchor: 'start',
    }),
    trail('steady', 1, 'M70 112 L320 112', 2200, hold(25, { reel: true }), { key: 'steady', x: 200, y: 100 }),
    trail('finish', 2, 'M320 112 C336 112 348 80 352 30', 800, move(25, 45, { reel: true }), {
      key: 'toFeet',
      x: 340,
      y: 136,
      anchor: 'end',
    }),
  ],
  { base: 25 },
);

export const stopGoDiagram = scene(
  [
    ...water,
    trail('dive', 0, 'M30 40 C40 90 55 118 75 120', 900, hold(25, { reel: true }), {
      key: 'dive',
      x: 12,
      y: 170,
      anchor: 'start',
    }),
    trail('go', 1, 'M75 120 L150 120', 900, hold(25, { reel: true }), { key: 'reelIn', x: 112, y: 142 }),
    trail('stop', 2, 'M150 120 C160 120 168 100 176 84', 1100, hold(25), { key: 'pauseRise', x: 176, y: 70 }),
    trail('go2', 3, 'M176 84 C186 84 196 120 214 120 L280 120', 1200, hold(25, { reel: true }), {
      key: 'goDive',
      x: 247,
      y: 142,
    }),
    trail('stop2', 4, 'M280 120 C290 120 298 100 306 84', 1100, hold(25), { key: 'pause', x: 306, y: 70 }),
  ],
  { base: 25 },
);

export const twitchDiagram = scene(
  [
    ...water,
    trail('dive', 0, 'M30 40 C40 70 55 88 80 90', 900, hold(15, { reel: true }), {
      key: 'toDepth',
      x: 90,
      y: 58,
      anchor: 'start',
    }),
    trail('twitch', 1, 'M80 90 L98 74 L116 100 L134 72 L152 98', 900, flicks(15, -5, 4, { slack: true }), {
      key: 'wrist',
      x: 116,
      y: 128,
    }),
    trail('hold', 2, 'M152 98 C158 96 164 94 170 94', 900, hold(15, { slack: true }), {
      key: 'pauseStand',
      x: 230,
      y: 58,
      anchor: 'start',
    }),
    trail(
      'again',
      3,
      'M170 94 L188 76 L206 102 L224 74 L242 100 C250 98 256 96 262 96 L280 78 L298 104 L316 76 L334 100',
      2000,
      flicks(15, -5, 8, { slack: true }),
      { key: 'vary', x: 300, y: 152 },
    ),
  ],
  { base: 15 },
);

/** Köder von oben gesehen (er bricht nach links und rechts aus), die Rute daneben von der Seite */
export const jerkDiagram = scene(
  [
    {
      id: 'view',
      step: 0,
      style: 'context',
      d: 'M12 26',
      label: { key: 'topView', x: 12, y: 20, anchor: 'start' },
    },
    {
      id: 'rodView',
      step: 0,
      style: 'context',
      d: 'M300 -20',
      label: { key: 'rodSide', x: 292, y: -76, anchor: 'end' },
    },
    trail('jerk', 0, 'M30 115 C55 112 70 80 90 62', 500, move(10, -25), {
      key: 'jerkDown',
      x: 100,
      y: 46,
      anchor: 'start',
    }),
    trail('slack', 1, 'M90 62 C96 58 100 60 104 64', 800, move(-25, 10, { reel: true }), {
      key: 'takeSlack',
      x: 30,
      y: 160,
      anchor: 'start',
    }),
    trail('jerk2', 2, 'M104 64 C130 90 150 150 168 166', 500, move(10, -25), {
      key: 'otherSide',
      x: 182,
      y: 196,
      anchor: 'start',
    }),
    trail(
      'again',
      3,
      'M168 166 C175 170 180 168 184 164 C205 140 225 80 244 64 C250 60 254 62 258 66 C280 92 300 150 318 166',
      2200,
      {
        keys: [
          [0, -25],
          [0.15, 10],
          [0.4, -25],
          [0.6, 10],
          [0.85, -25],
          [1, -25],
        ],
        reel: true,
      },
      { key: 'rhythm', x: 300, y: 46 },
    ),
  ],
  { base: 10, line: false },
);

export const verticalDiagram = scene(
  [
    ...water,
    {
      id: 'boat',
      step: 0,
      style: 'boat',
      d: 'M150 24 L250 24 L238 40 L162 40 Z',
      label: { key: 'boat', x: 258, y: 38, anchor: 'start' },
    },
    trail('drop', 0, 'M200 44 L200 196', 1500, hold(60), {
      key: 'dropDown',
      x: 212,
      y: 110,
      anchor: 'start',
    }),
    trail('lift', 1, 'M200 196 L200 172', 450, move(60, 80), {
      key: 'liftShort',
      x: 212,
      y: 170,
      anchor: 'start',
    }),
    trail('fall', 2, 'M200 172 L200 196', 900, move(80, 60), {
      key: 'groundContact',
      x: 188,
      y: 192,
      anchor: 'end',
    }),
    trail('drift', 3, 'M200 196 L212 174 L224 196 L236 174 L248 196', 2000, flicks(60, 78, 2), {
      key: 'drift',
      x: 150,
      y: 224,
    }),
  ],
  { base: 60, length: 40, boat: true },
);

export const dragDiagram = scene(
  [
    ...water,
    sink(30),
    trail('drag', 1, 'M60 200 C80 198 100 201 130 199', 1300, move(30, 100), {
      key: 'dragSide',
      x: 70,
      y: 170,
      anchor: 'start',
    }),
    trail('pause', 2, 'M130 199 L134 199', 900, move(100, 30, { reel: true }), {
      key: 'pauseSlack',
      x: 134,
      y: 224,
    }),
    trail(
      'again',
      3,
      'M134 199 C160 197 190 201 220 199 L224 199 C250 197 280 201 310 199',
      2400,
      {
        keys: [
          [0, 30],
          [0.48, 100],
          [0.52, 30],
          [1, 100],
        ],
      },
      { key: 'repeat', x: 330, y: 182, anchor: 'end' },
    ),
  ],
  { base: 30 },
);

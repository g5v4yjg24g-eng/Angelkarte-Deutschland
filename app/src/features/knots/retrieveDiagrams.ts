// Zeichnungen der Köderführung (eigene, schematische Darstellung): Seitenansicht des Wassers, der Angler steht rechts.
// Die Bahn (`trail`) zeigt, wie sich der Köder bewegt; ein Köder läuft sie im Takt ab (RigPlayer). `ms` gibt jeder
// Bewegung ihr Tempo (Absinken langsam, Anheben schnell). Beschriftungen: Schlüssel aus de.retrieves.labels.
import type { RigDiagramSpec, RigPart } from '../../domain/rigs';

const W = 400;
const H = 236;
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
    label: { key: 'ground', x: 392, y: 224, anchor: 'end' },
  },
  {
    id: 'angler',
    step: 0,
    style: 'context',
    d: 'M392 24 L392 24',
    label: { key: 'toAngler', x: 392, y: 18, anchor: 'end' },
  },
];
const trail = (id: string, step: number, d: string, ms: number, label?: RigPart['label']): RigPart =>
  label ? { id, step, style: 'trail', d, ms, label } : { id, step, style: 'trail', d, ms };
const sink = (label = true) =>
  trail(
    'sink',
    0,
    'M30 40 C40 90 50 160 60 200',
    1400,
    label ? { key: 'sink', x: 72, y: 90, anchor: 'start' } : undefined,
  );

export const jigDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    ...water,
    sink(),
    trail('hop', 1, 'M60 200 C66 160 84 140 100 140', 450, {
      key: 'jerkUp',
      x: 108,
      y: 128,
      anchor: 'start',
    }),
    trail('fall', 2, 'M100 140 C112 140 124 170 132 200', 1100, { key: 'fallBite', x: 132, y: 224 }),
    trail(
      'again',
      3,
      'M132 200 C138 160 156 140 172 140 C184 140 196 170 204 200 C210 160 228 140 244 140 C256 140 268 170 276 200',
      2400,
      { key: 'repeat', x: 300, y: 128, anchor: 'start' },
    ),
  ],
};

export const faulenzenDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    ...water,
    sink(),
    trail('reel', 1, 'M60 200 C70 185 90 168 120 166', 700, { key: 'turns', x: 70, y: 150, anchor: 'start' }),
    trail('fall', 2, 'M120 166 C134 166 146 184 152 200', 1000, { key: 'stopFall', x: 152, y: 224 }),
    trail(
      'again',
      3,
      'M152 200 C162 185 182 168 212 166 C226 166 238 184 244 200 C254 185 274 168 304 166 C318 166 330 184 336 200',
      2600,
      { key: 'repeat', x: 274, y: 150 },
    ),
  ],
};

export const steadyDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    ...water,
    trail('dive', 0, 'M30 40 C40 80 52 108 70 112', 1000, { key: 'toDepth', x: 80, y: 76, anchor: 'start' }),
    trail('steady', 1, 'M70 112 L330 112', 2200, { key: 'steady', x: 200, y: 100 }),
    trail('finish', 2, 'M330 112 C350 112 368 80 380 40', 800, {
      key: 'toFeet',
      x: 368,
      y: 136,
      anchor: 'end',
    }),
  ],
};

export const stopGoDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    ...water,
    trail('dive', 0, 'M30 40 C40 90 55 118 75 120', 900, { key: 'dive', x: 12, y: 170, anchor: 'start' }),
    trail('go', 1, 'M75 120 L150 120', 900, { key: 'reelIn', x: 112, y: 142 }),
    trail('stop', 2, 'M150 120 C160 120 168 100 176 84', 1100, { key: 'pauseRise', x: 176, y: 70 }),
    trail('go2', 3, 'M176 84 C186 84 196 120 214 120 L280 120', 1200, { key: 'goDive', x: 247, y: 142 }),
    trail('stop2', 4, 'M280 120 C290 120 298 100 306 84', 1100, { key: 'pause', x: 306, y: 70 }),
  ],
};

export const twitchDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    ...water,
    trail('dive', 0, 'M30 40 C40 70 55 88 80 90', 900, { key: 'toDepth', x: 90, y: 58, anchor: 'start' }),
    trail('twitch', 1, 'M80 90 L98 74 L116 100 L134 72 L152 98', 900, { key: 'wrist', x: 116, y: 128 }),
    trail('hold', 2, 'M152 98 C158 96 164 94 170 94', 900, {
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
      { key: 'vary', x: 300, y: 152 },
    ),
  ],
};

/** Ansicht von oben: der Köder bricht abwechselnd nach links und rechts aus */
export const jerkDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    {
      id: 'view',
      step: 0,
      style: 'context',
      d: 'M12 26 L12 26',
      label: { key: 'topView', x: 12, y: 20, anchor: 'start' },
    },
    {
      id: 'angler',
      step: 0,
      style: 'context',
      d: 'M392 26 L392 26',
      label: { key: 'toAngler', x: 392, y: 20, anchor: 'end' },
    },
    trail('jerk', 0, 'M30 115 C55 112 70 80 90 62', 500, { key: 'jerkDown', x: 100, y: 46, anchor: 'start' }),
    trail('slack', 1, 'M90 62 C96 58 100 60 104 64', 800, {
      key: 'takeSlack',
      x: 30,
      y: 160,
      anchor: 'start',
    }),
    trail('jerk2', 2, 'M104 64 C130 90 150 150 168 166', 500, {
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
      { key: 'rhythm', x: 300, y: 46 },
    ),
  ],
};

export const verticalDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    ...water,
    {
      id: 'boat',
      step: 0,
      style: 'boat',
      d: 'M150 24 L250 24 L238 40 L162 40 Z',
      label: { key: 'boat', x: 258, y: 38, anchor: 'start' },
    },
    trail('drop', 0, 'M200 44 L200 196', 1500, { key: 'dropDown', x: 212, y: 110, anchor: 'start' }),
    trail('lift', 1, 'M200 196 L200 172', 450, { key: 'liftShort', x: 212, y: 170, anchor: 'start' }),
    trail('fall', 2, 'M200 172 L200 196', 900, { key: 'groundContact', x: 188, y: 192, anchor: 'end' }),
    trail('drift', 3, 'M200 196 L212 174 L224 196 L236 174 L248 196', 2000, { key: 'drift', x: 236, y: 224 }),
  ],
};

export const dragDiagram: RigDiagramSpec = {
  width: W,
  height: H,
  lure: true,
  parts: [
    ...water,
    sink(),
    trail('drag', 1, 'M60 200 C80 198 100 201 130 199', 1300, {
      key: 'dragSide',
      x: 70,
      y: 170,
      anchor: 'start',
    }),
    trail('pause', 2, 'M130 199 L134 199', 900, { key: 'pauseSlack', x: 134, y: 224 }),
    trail('again', 3, 'M134 199 C160 197 190 201 220 199 L224 199 C250 197 280 201 310 199', 2400, {
      key: 'repeat',
      x: 330,
      y: 182,
      anchor: 'end',
    }),
  ],
};

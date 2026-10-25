// Zeichnungen der Knoten (eigene Darstellung, schematisch). Koordinaten im Raster der viewBox; Kreuzungen und
// Über/Unter siehe domain/knots.ts. Änderungen an den Pfaden: `cross` anpassen – der Test meldet Abweichungen.
import type { KnotDiagramSpec, StrandSpec } from '../../domain/knots';

/** Öhr (Ring) mit Schenkel nach links oben, als Bézier-Kreis */
function eye(cx: number, cy: number, r: number): StrandSpec[] {
  const k = 0.5523 * r;
  const d =
    `M${cx} ${cy - r} C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} ` +
    `C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} ` +
    `C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} ` +
    `C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}`;
  // Schenkel beginnt knapp außerhalb des Rings (sonst zählt die Berührung als Kreuzung)
  const a = (r + 2.5) * Math.SQRT1_2;
  return [
    { id: 'eye', style: 'hardware', chunks: [{ step: 0, d }], cross: '' },
    {
      id: 'shank',
      style: 'hardware',
      chunks: [{ step: 0, d: `M${cx - a} ${cy - a} L${cx - a - 34} ${cy - a - 34}` }],
      cross: '',
    },
  ];
}

/** n Windungen um eine waagerechte Schnur bei y0, Start im Tal; vorne hoch (O), hinten runter (U) */
function wraps(x0: number, n: number, half: number, top: number, bottom: number): string {
  let d = '';
  let x = x0;
  for (let i = 0; i < n; i++) {
    d += ` C${x + half / 2} ${bottom} ${x + half / 2} ${top} ${x + half} ${top}`;
    x += half;
    d += ` C${x + half / 2} ${top} ${x + half / 2} ${bottom} ${x + half} ${bottom}`;
    x += half;
  }
  return d;
}

export const clinchDiagram: KnotDiagramSpec = {
  width: 400,
  height: 200,
  strands: [
    ...eye(70, 100, 18),
    {
      id: 'line',
      style: 'line',
      chunks: [
        { step: 0, d: 'M390 94 L48 94 C30 94 28 124 46 124 L136 124' },
        { step: 1, d: wraps(136, 5, 20, 66, 124) },
        { step: 2, d: 'C372 124 378 36 338 36 L112 36 C100 36 96 44 96 56 L96 152' },
        { step: 3, d: 'C96 174 118 174 118 152 L118 10' },
      ],
      cross: 'UO' + 'OU'.repeat(5) + 'OOU' + 'OOU',
    },
  ],
  scenes: {
    4: {
      width: 400,
      height: 200,
      strands: [
        ...eye(70, 100, 18),
        { id: 'line', style: 'line', chunks: [{ step: 0, d: 'M390 100 L46 100' }], cross: 'UO' },
        ...Array.from({ length: 6 }, (_, k) => ({
          id: `coil${k}`,
          style: 'line' as const,
          chunks: [{ step: 0, d: `M${100 + 10 * k} 89 L${108 + 10 * k} 111` }],
          cross: 'O',
        })),
        { id: 'end', style: 'line', chunks: [{ step: 0, d: 'M102 113 L112 129' }], cross: '' },
      ],
    },
  },
};

/**
 * Kleeblatt-Kurve (Projektion eines Überhandknotens), Winkel in Grad; t läuft von t0 nach t1 (auch rückwärts).
 * Liefert L-Befehle, die am vorherigen Punkt fortsetzen.
 */
function trefoil(cx: number, cy: number, r: number, t0: number, t1: number): string {
  const pt = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    return [
      cx + r * (Math.sin(t) + 2 * Math.sin(2 * t)),
      cy + r * (Math.cos(t) - 2 * Math.cos(2 * t)),
    ] as const;
  };
  const n = Math.ceil(Math.abs(t1 - t0) / 4);
  let d = '';
  for (let k = 0; k <= n; k++) {
    const [x, y] = pt(t0 + ((t1 - t0) * k) / n);
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** Öhr mit Haken nach unten (Palomar) */
function hookEye(cx: number, cy: number, r: number): StrandSpec[] {
  const [ring] = eye(cx, cy, r);
  return [
    ring as StrandSpec,
    {
      id: 'hook',
      style: 'hardware',
      chunks: [
        {
          step: 0,
          d: `M${cx} ${cy + r + 2.5} L${cx} ${cy + r + 34} C${cx} ${cy + r + 56} ${cx - 30} ${cy + r + 56} ${cx - 32} ${cy + r + 36}`,
        },
      ],
      cross: '',
    },
  ];
}

const P = { cx: 196, cy: 104, r: 30 };
const ptOf = (deg: number) => {
  const t = (deg * Math.PI) / 180;
  return [
    P.cx + P.r * (Math.sin(t) + 2 * Math.sin(2 * t)),
    P.cy + P.r * (Math.cos(t) - 2 * Math.cos(2 * t)),
  ] as const;
};
const tip60 = ptOf(60);

const EYE = { x: tip60[0] - 6, y: tip60[1] - 4 };
/** Hauptschnur und Ende zweigen am Anfang der Doppelschnur ab */
const palomarEnds: StrandSpec[] = [
  { id: 'standing', style: 'line', chunks: [{ step: 0, d: 'M118 14 L16 8' }], cross: '' },
  { id: 'tag', style: 'line', chunks: [{ step: 0, d: 'M118 14 L74 40' }], cross: '' },
];
const palomarKnot = `M118 14 L${ptOf(170)[0].toFixed(1)} ${ptOf(170)[1].toFixed(1)}${trefoil(P.cx, P.cy, P.r, 170, -170)}`;

export const palomarDiagram: KnotDiagramSpec = {
  width: 400,
  height: 240,
  strands: [
    ...hookEye(EYE.x, EYE.y, 15),
    ...palomarEnds,
    {
      id: 'double',
      style: 'double',
      chunks: [
        {
          step: 0,
          d: `M118 14 L${ptOf(170)[0].toFixed(1)} ${ptOf(170)[1].toFixed(1)}${trefoil(P.cx, P.cy, P.r, 170, 30)}`,
        },
        { step: 1, d: `${trefoil(P.cx, P.cy, P.r, 30, -170)} L330 40` },
      ],
      // durch das Öhr; Überhandknoten abwechselnd (Kreuzungen in der Reihenfolge ihres zweiten Durchgangs)
      cross: 'UO' + 'UOU',
    },
  ],
  scenes: {
    // Schlaufe über den Haken geführt: der Haken liegt jetzt innerhalb der Schlaufe
    2: {
      width: 400,
      height: 240,
      strands: [
        ...hookEye(EYE.x, EYE.y, 15),
        ...palomarEnds,
        {
          id: 'double',
          style: 'double',
          chunks: [{ step: 0, d: `${palomarKnot} C360 30 372 234 290 234 C246 234 222 228 214 214` }],
          cross: 'UO' + 'UOU',
        },
      ],
    },
    // zugezogen: Knoten sitzt direkt über dem Öhr, die Doppelschnur führt hindurch
    3: {
      width: 400,
      height: 240,
      strands: [
        ...hookEye(EYE.x, EYE.y, 15),
        {
          id: 'knot',
          style: 'line',
          chunks: [
            {
              step: 0,
              d: `M16 8 L${(EYE.x - 5).toFixed(1)} ${(EYE.y - 77).toFixed(1)}${trefoil(EYE.x, EYE.y - 48, 10, 170, -170)} L${EYE.x + 30} ${EYE.y - 96}`,
            },
          ],
          cross: 'UOU',
        },
        {
          id: 'double',
          style: 'double',
          chunks: [
            {
              step: 0,
              d: `M${EYE.x + 9} ${EYE.y - 30} L${EYE.x + 9} ${EYE.y + 24}`,
            },
          ],
          cross: 'UO',
        },
      ],
    },
  },
};

/** Windungen des Uni-Knotens um beide Schnüre: hinten hoch (U U), vorne runter (O O) */
function uniWraps(x0: number, n: number, pitch: number, top: number, bottom: number): string {
  let d = '';
  let prev = x0;
  for (let k = 0; k < n; k++) {
    const up = x0 + 12 + pitch * k;
    const down = up + 13;
    d += ` C${prev} ${bottom + 14} ${up} ${bottom + 14} ${up} ${bottom} L${up} ${top}`;
    d += ` C${up} ${top - 12} ${down} ${top - 12} ${down} ${top} L${down} ${bottom}`;
    prev = down;
  }
  return d;
}

export const uniDiagram: KnotDiagramSpec = {
  width: 400,
  height: 200,
  strands: [
    ...eye(70, 100, 18),
    {
      id: 'line',
      style: 'line',
      chunks: [
        { step: 0, d: 'M390 94 L48 94 C30 94 28 124 46 124 L250 124' },
        { step: 1, d: 'C282 124 290 46 250 46 L128 46 C116 46 112 54 112 66 L112 146' },
        { step: 2, d: `${uniWraps(112, 5, 26, 70, 146)} C241 168 258 176 284 176` },
      ],
      cross: 'UO' + 'OOO' + 'UUOO'.repeat(5),
    },
  ],
  scenes: {
    // zugezogen und zum Öhr geschoben
    3: {
      width: 400,
      height: 200,
      strands: [
        ...eye(70, 100, 18),
        { id: 'line', style: 'line', chunks: [{ step: 0, d: 'M390 100 L46 100' }], cross: 'UO' },
        ...Array.from({ length: 6 }, (_, k) => ({
          id: `coil${k}`,
          style: 'line' as const,
          chunks: [{ step: 0, d: `M${100 + 10 * k} 89 L${108 + 10 * k} 111` }],
          cross: 'O',
        })),
        { id: 'end', style: 'line', chunks: [{ step: 0, d: 'M156 112 L168 128' }], cross: '' },
      ],
    },
  },
};

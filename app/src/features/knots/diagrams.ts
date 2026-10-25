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

/**
 * Windungen um zwei parallele Schnüre, als senkrechte Durchgänge ab (x0, yFrom): erst zur Gegenseite yTo, dann
 * zurück. dx = Richtung (+1 rechts, −1 links). Der erste Durchgang liegt hinten, der zweite vorn.
 */
function vWraps(x0: number, dx: number, n: number, yFrom: number, yTo: number): string {
  const s = Math.sign(yFrom - yTo); // nach außen
  let d = '';
  let x = x0;
  for (let k = 0; k < n; k++) {
    const x1 = x + dx * 12;
    const x2 = x1 + dx * 13;
    d += ` C${x} ${yFrom + s * 14} ${x1} ${yFrom + s * 14} ${x1} ${yFrom} L${x1} ${yTo}`;
    d += ` C${x1} ${yTo - s * 12} ${x2} ${yTo - s * 12} ${x2} ${yTo} L${x2} ${yFrom}`;
    x = x2;
  }
  return d;
}

/** kurze Querstriche als zugezogene Windungen (Ersatzbilder) */
function coils(
  id: string,
  style: 'line' | 'line2',
  x0: number,
  n: number,
  step: number,
  y0 = 88,
  y1 = 112,
  cross = 'O',
) {
  return Array.from({ length: n }, (_, k) => ({
    id: `${id}${k}`,
    style,
    chunks: [{ step: 0, d: `M${x0 + step * k} ${y0} L${x0 + step * k + 7} ${y1}` }],
    cross,
  }));
}

export const doubleUniDiagram: KnotDiagramSpec = {
  width: 400,
  height: 200,
  strands: [
    {
      id: 'a',
      style: 'line',
      chunks: [
        { step: 0, d: 'M10 94 L350 94' },
        {
          step: 1,
          d: `C380 94 386 34 350 34 L238 34 C228 34 224 42 224 52 L224 146${vWraps(224, 1, 4, 146, 62)} C324 168 340 176 366 176`,
        },
      ],
      cross: 'O' + 'UO'.repeat(4),
    },
    {
      id: 'b',
      style: 'line2',
      chunks: [
        { step: 0, d: 'M390 118 L50 118' },
        {
          step: 2,
          d: `C20 118 14 176 50 176 L164 176 C174 176 178 168 178 158 L178 56${vWraps(178, -1, 4, 56, 150)} C78 40 60 24 30 20`,
        },
      ],
      // zuerst unter/über den Windungen von a, dann der eigene Uni-Knoten
      cross: 'UO'.repeat(4) + 'U' + 'OO' + 'UUOO'.repeat(4),
    },
  ],
  scenes: {
    3: {
      width: 400,
      height: 200,
      strands: [
        { id: 'a', style: 'line', chunks: [{ step: 0, d: 'M10 96 L236 96' }], cross: '' },
        { id: 'b', style: 'line2', chunks: [{ step: 0, d: 'M390 104 L164 104' }], cross: '' },
        ...coils('cb', 'line2', 168, 4, 8, 84, 116, 'OO'),
        ...coils('ca', 'line', 204, 4, 8, 84, 116, 'OO'),
        { id: 'tb', style: 'line2', chunks: [{ step: 0, d: 'M164 82 L154 66' }], cross: '' },
        { id: 'ta', style: 'line', chunks: [{ step: 0, d: 'M238 118 L248 134' }], cross: '' },
      ],
    },
  },
};

export const surgeonDiagram: KnotDiagramSpec = {
  width: 400,
  height: 200,
  strands: [
    // links: Hauptschnur (blau) und Ende des Vorfachs (orange) laufen in das Schnurpaar
    { id: 'main', style: 'line', chunks: [{ step: 0, d: 'M40 120 L4 104' }], cross: '' },
    { id: 'leaderEnd', style: 'line2', chunks: [{ step: 0, d: 'M40 120 L14 140' }], cross: '' },
    {
      id: 'pair',
      style: 'double',
      chunks: [
        { step: 0, d: 'M40 120 L220 120' },
        { step: 1, d: 'C252 120 256 50 220 50 L162 50 C152 50 150 58 150 68 L150 146' },
        {
          step: 2,
          d:
            'C150 160 160 162 172 162 C180 162 182 156 182 146 L182 30 ' +
            'C182 18 130 14 128 40 L128 150 C128 176 200 180 204 166 L204 24',
        },
      ],
      cross: 'O' + 'UO' + 'U' + 'UO',
    },
  ],
  scenes: {
    3: {
      width: 400,
      height: 200,
      strands: [
        { id: 'main', style: 'line', chunks: [{ step: 0, d: 'M4 100 L170 100' }], cross: '' },
        { id: 'leader', style: 'line2', chunks: [{ step: 0, d: 'M396 100 L230 100' }], cross: '' },
        {
          id: 'knot',
          style: 'line',
          chunks: [{ step: 0, d: `M182 78${trefoil(200, 104, 9, 170, -170)}` }],
          cross: 'UOU',
        },
        { id: 'mainEnd', style: 'line', chunks: [{ step: 0, d: 'M218 78 L232 64' }], cross: '' },
        { id: 'leaderEnd', style: 'line2', chunks: [{ step: 0, d: 'M186 128 L172 144' }], cross: '' },
      ],
    },
  },
};

/** Kreuzwicklung um eine waagerechte Schnur bei y = 100: S-Bögen zwischen oben und unten */
function crisscross(x0: number, n: number, half: number, top: number, bottom: number): string {
  let d = '';
  let x = x0;
  let up = true;
  for (let k = 0; k < n; k++) {
    const [y0, y1] = up ? [top, bottom] : [bottom, top];
    d += ` C${x + half / 2} ${y0} ${x + half / 2} ${y1} ${x + half} ${y1}`;
    x += half;
    up = !up;
  }
  return d;
}

const FG_WRAP = `M10 100 L140 100 C148 100 148 82 156 82${crisscross(156, 10, 16, 82, 118)}`;

export const fgDiagram: KnotDiagramSpec = {
  width: 400,
  height: 200,
  strands: [
    {
      id: 'braid',
      style: 'line',
      chunks: [
        { step: 0, d: 'M10 100 L140 100' },
        { step: 1, d: `C148 100 148 82 156 82${crisscross(156, 10, 16, 82, 118)}` },
      ],
      cross: '',
    },
    { id: 'leader', style: 'line2', chunks: [{ step: 0, d: 'M390 100 L150 100' }], cross: 'UO'.repeat(5) },
  ],
  scenes: {
    // zwei halbe Schläge mit der Geflochtenen um das Vorfach
    2: {
      width: 400,
      height: 200,
      strands: [
        { id: 'braid', style: 'line', chunks: [{ step: 0, d: FG_WRAP }], cross: '' },
        {
          id: 'leader',
          style: 'line2',
          chunks: [{ step: 0, d: 'M390 100 L150 100' }],
          cross: 'UO'.repeat(5),
        },
        ...coils('hitch', 'line', 324, 2, 12, 84, 116),
        { id: 'end', style: 'line', chunks: [{ step: 0, d: 'M344 118 L356 134' }], cross: '' },
      ],
    },
    // Vorfach gekürzt, Abschluss mit halben Schlägen um die Hauptschnur
    3: {
      width: 400,
      height: 200,
      strands: [
        { id: 'braid', style: 'line', chunks: [{ step: 0, d: FG_WRAP }], cross: '' },
        {
          id: 'leader',
          style: 'line2',
          chunks: [{ step: 0, d: 'M390 100 L160 100' }],
          cross: 'UO'.repeat(5),
        },
        ...coils('hitch', 'line', 324, 2, 12, 84, 116),
        ...coils('lock', 'line', 104, 3, 10, 84, 116),
        { id: 'end', style: 'line', chunks: [{ step: 0, d: 'M126 84 L136 70' }], cross: '' },
      ],
    },
  },
};

export const perfectionDiagram: KnotDiagramSpec = {
  width: 400,
  height: 220,
  strands: [
    {
      id: 'line',
      style: 'line',
      chunks: [
        // Hauptschnur von unten; erste Schlaufe nach links, das Ende läuft hinter der Hauptschnur nach rechts
        {
          step: 0,
          d: 'M200 216 L200 110 C200 56 150 34 116 50 C84 66 84 120 112 140 C136 158 180 160 260 156',
        },
        // zweite, kleinere Schlaufe vor der ersten
        { step: 1, d: 'C300 154 312 100 278 78 C250 60 200 70 176 92 C156 112 164 140 196 140' },
        // das Ende quer zwischen den beiden Schlaufen hindurch
        { step: 2, d: 'C236 140 268 122 300 110 L380 84' },
      ],
      // erste Schlaufe hinter der Hauptschnur; zweite vor der ersten; Ende über der Hauptschnur, unter der zweiten
      cross: 'UOOU',
    },
  ],
  scenes: {
    // die zweite Schlaufe durch die erste gezogen
    3: {
      width: 400,
      height: 220,
      strands: [
        { id: 'standing', style: 'line', chunks: [{ step: 0, d: 'M200 216 L200 156' }], cross: '' },
        {
          id: 'loop2',
          style: 'line',
          chunks: [{ step: 0, d: 'M190 150 C166 104 168 30 200 26 C232 30 234 104 212 150' }],
          cross: '',
        },
        {
          id: 'loop1',
          style: 'line',
          chunks: [
            {
              step: 0,
              d: 'M200 156 C150 156 140 120 176 112 C204 106 246 108 248 128 C250 146 232 152 214 150',
            },
          ],
          cross: 'UO',
        },
        { id: 'end', style: 'line', chunks: [{ step: 0, d: 'M214 150 L300 126' }], cross: 'O' },
      ],
    },
    // zugezogen
    4: {
      width: 400,
      height: 220,
      strands: [
        { id: 'standing', style: 'line', chunks: [{ step: 0, d: 'M200 216 L200 166' }], cross: '' },
        {
          id: 'loop',
          style: 'line',
          chunks: [{ step: 0, d: 'M194 142 C170 100 174 30 200 26 C226 30 230 100 206 142' }],
          cross: '',
        },
        {
          id: 'knot',
          style: 'line',
          chunks: [{ step: 0, d: `M186 140${trefoil(200, 154, 6, 170, -170)}` }],
          cross: 'UUOU',
        },
        { id: 'end', style: 'line', chunks: [{ step: 0, d: 'M214 140 L236 128' }], cross: '' },
      ],
    },
  },
};

/** Spule der Rolle: Kern (Kreis) mit Achse */
function spool(cx: number, cy: number, r: number): StrandSpec[] {
  const ring = (rr: number) => {
    const k = 0.5523 * rr;
    return (
      `M${cx} ${cy - rr} C${cx + k} ${cy - rr} ${cx + rr} ${cy - k} ${cx + rr} ${cy} ` +
      `C${cx + rr} ${cy + k} ${cx + k} ${cy + rr} ${cx} ${cy + rr} ` +
      `C${cx - k} ${cy + rr} ${cx - rr} ${cy + k} ${cx - rr} ${cy} ` +
      `C${cx - rr} ${cy - k} ${cx - k} ${cy - rr} ${cx} ${cy - rr}`
    );
  };
  return [
    { id: 'core', style: 'hardware', chunks: [{ step: 0, d: ring(r) }], cross: '' },
    { id: 'axle', style: 'hardware', chunks: [{ step: 0, d: ring(8) }], cross: '' },
  ];
}

export const arborDiagram: KnotDiagramSpec = {
  width: 400,
  height: 200,
  strands: [
    ...spool(110, 100, 32),
    {
      id: 'line',
      style: 'line',
      chunks: [
        // um die Spule herum
        { step: 0, d: 'M390 60 L110 60 C88 60 70 78 70 100 C70 122 88 140 110 140 L226 140' },
        // einfacher Knoten mit dem Ende um die Hauptschnur
        {
          step: 1,
          d: 'C240 140 242 124 242 100 L242 44 C242 30 258 30 258 44 L258 84 C258 98 236 100 222 90 L210 78',
        },
        // Stopperknoten ganz am Ende
        { step: 2, d: `L${(196 - 3).toFixed(0)} 96${trefoil(196, 112, 6, 170, -170)}` },
      ],
      cross: 'OUU' + 'UOU',
    },
  ],
  scenes: {
    3: {
      width: 400,
      height: 200,
      strands: [
        ...spool(110, 100, 32),
        {
          id: 'line',
          style: 'line',
          chunks: [
            {
              step: 0,
              d: 'M390 64 L110 64 C90 64 74 80 74 100 C74 120 90 136 110 136 C130 136 146 120 146 100 C146 88 142 80 136 74',
            },
          ],
          cross: '',
        },
        {
          id: 'knot',
          style: 'line',
          chunks: [{ step: 0, d: trefoil(150, 60, 5, 170, -170).replace(' L', 'M') }],
          // Knoten liegt auf der Schnur an der Spule
          cross: 'OOUOOOU',
        },
      ],
    },
  },
};

export const snellDiagram: KnotDiagramSpec = {
  width: 400,
  height: 200,
  strands: [
    ...eye(50, 100, 13).slice(0, 1),
    {
      id: 'hook',
      style: 'hardware',
      chunks: [{ step: 0, d: 'M65.5 100 L300 100 C340 100 350 150 312 158 L272 150' }],
      cross: '',
    },
    {
      id: 'line',
      style: 'line',
      chunks: [
        // durch das Öhr, Ende am Schenkel entlang
        { step: 0, d: 'M10 46 L42 90 C50 104 60 120 80 120 L250 120' },
        // Schlaufe zurück Richtung Öhr
        { step: 1, d: 'C280 120 286 52 250 52 L134 52 C122 52 118 60 118 70 L118 146' },
        // Windungen um Schenkel und Schnur
        { step: 2, d: `${vWraps(118, 1, 5, 146, 70)} C243 168 256 176 268 178` },
      ],
      // durch das Öhr; Schlaufe vorn über Schenkel und Schnur; Windungen hinten hoch, vorn runter
      cross: 'UO' + 'O' + 'OO' + 'UUOO'.repeat(5),
    },
  ],
  scenes: {
    3: {
      width: 400,
      height: 200,
      strands: [
        ...eye(50, 100, 13).slice(0, 1),
        {
          id: 'hook',
          style: 'hardware',
          chunks: [{ step: 0, d: 'M65.5 100 L300 100 C340 100 350 150 312 158 L272 150' }],
          cross: '',
        },
        {
          id: 'line',
          style: 'line',
          chunks: [{ step: 0, d: 'M10 46 L42 90 C50 104 60 108 80 108' }],
          cross: 'UO',
        },
        ...coils('coil', 'line', 82, 7, 9, 88, 114),
        { id: 'end', style: 'line', chunks: [{ step: 0, d: 'M148 114 L158 130' }], cross: '' },
      ],
    },
  },
};

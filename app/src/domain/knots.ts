// Knoten-Anleitungen (Wunsch Nutzer 2026-10-25): Zeichenkern für die Schritt-für-Schritt-Animation.
// Eine Zeichnung besteht aus Strängen (Öhr/Haken, Schnur). Jeder Strang wird als Pfad (M, L, C) beschrieben und in
// Abschnitte je Schritt geteilt. Kreuzungen werden hier berechnet; je neu entstehender Kreuzung legt die Vorgabe
// `cross` fest, ob der gerade gezeichnete Strang oben (O) oder unten (U) liegt. Das Ergebnis sind Teilstücke mit
// Ebene (z): Das obere Stück an einer Kreuzung wird mit einem Rand in Hintergrundfarbe erneut gezeichnet.
// Rein und ohne DOM – die Ansicht rendert die Teilstücke als SVG.

export type Pt = readonly [number, number];
/** line: Hauptschnur, line2: zweite Schnur (Vorfach), double: doppelt gelegte Schnur, hardware: Öhr/Haken/Spule */
export type StrandStyle = 'line' | 'line2' | 'double' | 'hardware';

export interface StrandSpec {
  id: string;
  style: StrandStyle;
  /** Pfadabschnitte je Schritt (0-basiert); der erste beginnt mit M, die weiteren setzen am letzten Punkt fort. */
  chunks: { step: number; d: string }[];
  /** je neuer Kreuzung entlang des Strangs (mit bereits gezeichneten Strängen oder sich selbst): O = oben, U = unten */
  cross: string;
}

export interface KnotDiagramSpec {
  width: number;
  height: number;
  strands: StrandSpec[];
  /**
   * Schritte, die statt der aufgebauten Zeichnung ein eigenes Bild zeigen (z. B. der zugezogene Knoten oder die
   * verlegte Schlaufe). Das Bild ist eine eigene Zeichnung; alle ihre Stränge gehören zu Schritt 0.
   */
  scenes?: Record<number, KnotDiagramSpec>;
}

export interface Piece {
  strand: string;
  style: StrandStyle;
  z: number;
  d: string;
  /** oberes Stück: Linie minimal verlängert, damit an den Anschlüssen keine Kantenglättungs-Lücke bleibt */
  dLine: string;
  step: number;
  /** oberes Stück erst ab diesem Schritt anheben (vorher liegt dort noch keine Kreuzung) */
  raiseFrom: number;
  /** Bogenlänge im Strang: Beginn/Ende des Stücks und Beginn des Schrittabschnitts (für die Animationszeit) */
  from: number;
  to: number;
  stepStart: number;
}

export interface Crossing {
  strand: string;
  other: string;
  at: Pt;
  over: boolean;
  /** Schritt des gerade gezeichneten bzw. des gekreuzten Teils */
  steps: [number, number];
}

export interface KnotDiagram {
  width: number;
  height: number;
  steps: number;
  pieces: Piece[];
  crossings: Crossing[];
  scenes: Record<number, KnotDiagram>;
  /** Vorgabe passt nicht zu den gefundenen Kreuzungen (für Tests) */
  problems: string[];
}

/** Überlappung oberer Stücke mit dem Anschluss (px) */
const OVERLAP = 1.5;
/** halbe Länge des oberen Stücks an einer Kreuzung (px) */
export const PATCH_HALF = 7;
const SAMPLE_PX = 2;

interface Seg {
  kind: 'L' | 'C';
  p: Pt[];
  step: number;
}

function parse(chunks: StrandSpec['chunks']): Seg[] {
  const segs: Seg[] = [];
  let cur: Pt | undefined;
  for (const { step, d } of chunks) {
    const tok = d.match(/[MLC]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
    let i = 0;
    let cmd = '';
    const num = () => Number(tok[i++]);
    while (i < tok.length) {
      if (/^[MLC]$/i.test(tok[i] ?? '')) cmd = (tok[i++] ?? '').toUpperCase();
      if (cmd === 'M') {
        cur = [num(), num()];
        cmd = 'L';
      } else if (cmd === 'L') {
        const p: Pt = [num(), num()];
        if (!cur) throw new Error('Pfad ohne Anfang');
        segs.push({ kind: 'L', p: [cur, p], step });
        cur = p;
      } else if (cmd === 'C') {
        const a: Pt = [num(), num()];
        const b: Pt = [num(), num()];
        const p: Pt = [num(), num()];
        if (!cur) throw new Error('Pfad ohne Anfang');
        segs.push({ kind: 'C', p: [cur, a, b, p], step });
        cur = p;
      } else throw new Error(`Unbekannter Pfadbefehl in „${d}“`);
    }
  }
  return segs;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function bez(p: Pt[], t: number): Pt {
  const [p0, p1, p2, p3] = p as [Pt, Pt, Pt, Pt];
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

interface Sampled {
  pts: Pt[];
  len: number[];
  step: number[];
}

function sample(segs: Seg[]): Sampled {
  const pts: Pt[] = [];
  const step: number[] = [];
  for (const s of segs) {
    const approx =
      s.kind === 'L'
        ? dist(s.p[0] as Pt, s.p[1] as Pt)
        : dist(s.p[0] as Pt, s.p[1] as Pt) +
          dist(s.p[1] as Pt, s.p[2] as Pt) +
          dist(s.p[2] as Pt, s.p[3] as Pt);
    const n = Math.max(1, Math.ceil(approx / SAMPLE_PX));
    if (!pts.length) {
      pts.push(s.p[0] as Pt);
      step.push(s.step);
    }
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const a = s.p[0] as Pt;
      const b = s.p[s.p.length - 1] as Pt;
      pts.push(s.kind === 'L' ? [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] : bez(s.p, t));
      step.push(s.step);
    }
  }
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push((len[i - 1] ?? 0) + dist(pts[i - 1] as Pt, pts[i] as Pt));
  return { pts, len, step };
}

function intersect(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; u: number } | undefined {
  const r: Pt = [b[0] - a[0], b[1] - a[1]];
  const s: Pt = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return undefined;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t < 1 && u >= 0 && u < 1 ? { t, u } : undefined;
}

/** Kreuzungen von Segment-Index i (Strang A) mit allen Segmenten von B; bei A === B nur deutlich frühere. */
function hits(a: Sampled, i: number, b: Sampled, self: boolean) {
  const out: { sa: number; sb: number; at: Pt }[] = [];
  const p = a.pts[i] as Pt;
  const q = a.pts[i + 1] as Pt;
  const sa0 = a.len[i] ?? 0;
  for (let j = 0; j < b.pts.length - 1; j++) {
    if (self && (b.len[j + 1] ?? 0) > sa0 - 3 * SAMPLE_PX) break;
    const x = intersect(p, q, b.pts[j] as Pt, b.pts[j + 1] as Pt);
    if (!x) continue;
    const sa = sa0 + x.t * ((a.len[i + 1] ?? 0) - sa0);
    const sb = (b.len[j] ?? 0) + x.u * ((b.len[j + 1] ?? 0) - (b.len[j] ?? 0));
    out.push({ sa, sb, at: [p[0] + (q[0] - p[0]) * x.t, p[1] + (q[1] - p[1]) * x.t] });
  }
  return out;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

function pathBetween(sm: Sampled, from: number, to: number): string {
  const pts: Pt[] = [];
  const at = (s: number): Pt => {
    let i = 0;
    while (i < sm.len.length - 2 && (sm.len[i + 1] ?? 0) < s) i++;
    const s0 = sm.len[i] ?? 0;
    const s1 = sm.len[i + 1] ?? s0;
    const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    const p = sm.pts[i] as Pt;
    const q = (sm.pts[i + 1] ?? p) as Pt;
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  pts.push(at(from));
  for (let i = 0; i < sm.len.length; i++) {
    const s = sm.len[i] ?? 0;
    if (s > from && s < to) pts.push(sm.pts[i] as Pt);
  }
  pts.push(at(to));
  return pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p[0])} ${fmt(p[1])}`).join('');
}

/** Bogenlänge, an der ein Schritt im Strang beginnt bzw. endet */
function stepRange(sm: Sampled, step: number): [number, number] | undefined {
  let a: number | undefined;
  let b: number | undefined;
  for (let i = 1; i < sm.pts.length; i++) {
    if (sm.step[i] !== step) continue;
    a ??= sm.len[i - 1] ?? 0;
    b = sm.len[i] ?? 0;
  }
  return a === undefined || b === undefined ? undefined : [a, b];
}

export function buildDiagram(spec: KnotDiagramSpec): KnotDiagram {
  const problems: string[] = [];
  const sampled = new Map<string, Sampled>();
  /** [von, bis, ab Schritt]: erst wenn beide Teile einer Kreuzung gezeichnet sind, wird das obere Stück angehoben */
  const patches = new Map<string, [number, number, number][]>();
  const crossings: Crossing[] = [];
  const addPatch = (id: string, s: number, from: number) =>
    patches.get(id)?.push([s - PATCH_HALF, s + PATCH_HALF, from]);
  const stepAt = (sm: Sampled, s: number) =>
    sm.step[
      Math.max(
        1,
        sm.len.findIndex((l) => l >= s),
      )
    ] ?? 0;

  for (const st of spec.strands) {
    const sm = sample(parse(st.chunks));
    sampled.set(st.id, sm);
    patches.set(st.id, []);
    const found: { sa: number; sb: number; at: Pt; other: string }[] = [];
    for (let i = 0; i < sm.pts.length - 1; i++) {
      const local: typeof found = [];
      for (const [oid, other] of sampled) {
        const self = oid === st.id;
        for (const h of hits(sm, i, other, self)) local.push({ ...h, other: oid });
      }
      // Berührungen an Strangenden (gemeinsamer Anfang von Haupt- und Doppelschnur) sind keine Kreuzungen
      const ends = (x: Sampled) => [x.pts[0] as Pt, x.pts.at(-1) as Pt];
      const atEnd = (h: (typeof local)[number]) =>
        [...ends(sm), ...ends(sampled.get(h.other) as Sampled)].some((e) => dist(e, h.at) < 3);
      local.splice(0, local.length, ...local.filter((h) => !atEnd(h)));
      local.sort((x, y) => x.sa - y.sa);
      for (const h of local)
        if (!found.some((f) => f.other === h.other && dist(f.at, h.at) < 2 * SAMPLE_PX)) found.push(h);
    }
    if (found.length !== st.cross.length)
      problems.push(`${st.id}: ${found.length} Kreuzungen, Vorgabe nennt ${st.cross.length}`);
    found.forEach((f, k) => {
      const over = st.cross[k] !== 'U';
      const from = Math.max(stepAt(sm, f.sa), stepAt(sampled.get(f.other) as Sampled, f.sb));
      if (over) addPatch(st.id, f.sa, from);
      else addPatch(f.other, f.sb, from);
      crossings.push({
        strand: st.id,
        other: f.other,
        at: f.at,
        over,
        steps: [stepAt(sm, f.sa), stepAt(sampled.get(f.other) as Sampled, f.sb)],
      });
    });
  }

  const steps =
    Math.max(
      0,
      ...spec.strands.flatMap((s) => s.chunks.map((c) => c.step)),
      ...Object.keys(spec.scenes ?? {}).map(Number),
    ) + 1;

  const pieces: Piece[] = [];
  for (const st of spec.strands) {
    const sm = sampled.get(st.id) as Sampled;
    const total = sm.len.at(-1) ?? 0;
    const merged = (patches.get(st.id) ?? [])
      .map(([a, b, f]) => [Math.max(0, a), Math.min(total, b), f] as [number, number, number])
      .sort((x, y) => x[0] - y[0])
      .reduce<[number, number, number][]>((acc, p) => {
        const last = acc.at(-1);
        if (last && p[0] <= last[1]) {
          last[1] = Math.max(last[1], p[1]);
          last[2] = Math.min(last[2], p[2]);
        } else acc.push([...p]);
        return acc;
      }, []);
    for (let step = 0; step < steps; step++) {
      const r = stepRange(sm, step);
      if (!r) continue;
      const cuts = new Set([r[0], r[1]]);
      for (const [a, b] of merged) {
        if (a > r[0] && a < r[1]) cuts.add(a);
        if (b > r[0] && b < r[1]) cuts.add(b);
      }
      const sorted = [...cuts].sort((x, y) => x - y);
      for (let k = 0; k < sorted.length - 1; k++) {
        const from = sorted[k] as number;
        const to = sorted[k + 1] as number;
        if (to - from < 0.01) continue;
        const mid = (from + to) / 2;
        const patch = merged.find(([a, b]) => mid > a && mid < b);
        const z = patch ? 1 : 0;
        pieces.push({
          strand: st.id,
          style: st.style,
          z,
          d: pathBetween(sm, from, to),
          dLine:
            z > 0
              ? pathBetween(sm, Math.max(0, from - OVERLAP), Math.min(total, to + OVERLAP))
              : pathBetween(sm, from, to),
          step,
          from,
          to,
          stepStart: r[0],
          raiseFrom: patch ? patch[2] : Infinity,
        });
      }
    }
  }
  const scenes: Record<number, KnotDiagram> = {};
  for (const [k, sc] of Object.entries(spec.scenes ?? {})) {
    const built = buildDiagram(sc);
    scenes[Number(k)] = built;
    problems.push(...built.problems.map((p) => `Bild ${Number(k) + 1}: ${p}`));
  }
  return { width: spec.width, height: spec.height, steps, pieces, crossings, scenes, problems };
}

/** Teilstücke, die in Schritt `step` sichtbar sind, und ob sie gerade neu gezeichnet werden. */
export function piecesForStep(d: KnotDiagram, step: number): { piece: Piece; isNew: boolean }[] {
  return d.pieces
    .filter((p) => p.step <= step)
    .map((piece) => ({ piece, isNew: piece.step === step && piece.style !== 'hardware' }));
}

/** Einblenddauer eines Ersatzbilds */
export const SCENE_FADE_MS = 600;

/** Zeichengeschwindigkeit der Animation (px/s) */
export const DRAW_SPEED = 160;

export function animationTiming(p: Piece): { delayMs: number; durationMs: number } {
  return {
    delayMs: Math.round(((p.from - p.stepStart) / DRAW_SPEED) * 1000),
    durationMs: Math.max(1, Math.round(((p.to - p.from) / DRAW_SPEED) * 1000)),
  };
}

/** Dauer, bis ein Schritt fertig gezeichnet ist (für das automatische Weiterschalten). */
export function stepDurationMs(d: KnotDiagram, step: number): number {
  if (d.scenes[step]) return SCENE_FADE_MS;
  return Math.max(
    0,
    ...d.pieces
      .filter((p) => p.step === step && p.style !== 'hardware')
      .map((p) => {
        const t = animationTiming(p);
        return t.delayMs + t.durationMs;
      }),
  );
}

export type DrawLayer = 'halo' | 'line' | 'inner';

export interface DrawOp {
  key: string;
  layer: DrawLayer;
  style: StrandStyle;
  d: string;
  /** nur bei neu gezeichneten Stücken; ohne Animation sofort sichtbar */
  timing?: { delayMs: number; durationMs: number } | undefined;
  /** gehört zu einem Ersatzbild: wird eingeblendet statt gezeichnet */
  fade?: boolean | undefined;
  /** gerade Enden: oberes Stück an einer Kreuzung (runde Enden ergäben sichtbare Kerben an den Anschlüssen) */
  butt?: boolean | undefined;
}

const LAYERS_OF: Record<StrandStyle, DrawLayer[]> = {
  hardware: ['halo', 'line'],
  line: ['halo', 'line'],
  line2: ['halo', 'line'],
  double: ['halo', 'line', 'inner'],
};

/**
 * Zeichenbefehle für einen Schritt in Reihenfolge: je Ebene (z) erst alle Ränder in Hintergrundfarbe, dann die
 * Linien – so verdeckt ein oberes Stück an einer Kreuzung das untere, aber nie den eigenen Anschluss.
 */
export function drawOps(d: KnotDiagram, step: number): DrawOp[] {
  const scene = d.scenes[step];
  type Item = {
    key: string;
    style: StrandStyle;
    z: number;
    d: string;
    dLine: string;
    timing?: DrawOp['timing'];
    fade?: boolean;
  };
  const items: Item[] = scene
    ? scene.pieces.map((p, i) => ({
        key: `s${step}-${i}`,
        style: p.style,
        z: p.z,
        d: p.d,
        dLine: p.dLine,
        fade: p.style !== 'hardware',
      }))
    : piecesForStep(d, step).map(({ piece, isNew }, i) => ({
        key: `p${i}`,
        style: piece.style,
        z: step >= piece.raiseFrom ? piece.z : 0,
        d: piece.d,
        dLine: step >= piece.raiseFrom ? piece.dLine : piece.d,
        timing: isNew ? animationTiming(piece) : undefined,
      }));
  const zs = [...new Set(items.map((i) => i.z))].sort((a, b) => a - b);
  const ops: DrawOp[] = [];
  for (const z of zs) {
    const at = items.filter((i) => i.z === z);
    for (const layer of ['halo', 'line', 'inner'] as DrawLayer[])
      for (const it of at)
        if (LAYERS_OF[it.style].includes(layer))
          ops.push({
            key: `${it.key}-${layer}`,
            layer,
            style: it.style,
            d: layer === 'halo' ? it.d : it.dLine,
            timing: it.timing,
            fade: it.fade,
            butt: layer === 'halo' || z > 0,
          });
  }
  return ops;
}

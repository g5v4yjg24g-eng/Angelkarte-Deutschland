import { describe, expect, it } from 'vitest';
import {
  animationTiming,
  buildDiagram,
  drawOps,
  piecesForStep,
  SCENE_FADE_MS,
  stepDurationMs,
  type KnotDiagramSpec,
} from './knots';

// Waagerechte Schnur, dann eine senkrechte, die sie einmal kreuzt
const spec = (cross: string): KnotDiagramSpec => ({
  width: 100,
  height: 100,
  strands: [
    { id: 'a', style: 'line', chunks: [{ step: 0, d: 'M0 50 L100 50' }], cross: '' },
    {
      id: 'b',
      style: 'line',
      chunks: [
        { step: 0, d: 'M30 10 L30 40' },
        { step: 1, d: 'L30 90' },
      ],
      cross,
    },
  ],
});

describe('Knoten-Zeichenkern (KNT-1)', () => {
  it('findet die Kreuzung und legt das obere Stück auf Ebene 1', () => {
    const over = buildDiagram(spec('O'));
    expect(over.problems).toEqual([]);
    expect(over.crossings).toHaveLength(1);
    expect(over.crossings[0]).toMatchObject({ strand: 'b', other: 'a', over: true });
    expect(over.pieces.filter((p) => p.strand === 'b' && p.z === 1)).toHaveLength(1);
    expect(over.pieces.filter((p) => p.strand === 'a' && p.z === 1)).toHaveLength(0);

    const under = buildDiagram(spec('U'));
    expect(under.pieces.filter((p) => p.strand === 'a' && p.z === 1)).toHaveLength(1);
    expect(under.pieces.filter((p) => p.strand === 'b' && p.z === 1)).toHaveLength(0);
  });

  it('meldet, wenn die Vorgabe nicht zu den Kreuzungen passt', () => {
    expect(buildDiagram(spec('')).problems).toEqual(['b: 1 Kreuzungen, Vorgabe nennt 0']);
    expect(buildDiagram(spec('OU')).problems).toEqual(['b: 1 Kreuzungen, Vorgabe nennt 2']);
  });

  it('Berührung an einem Strangende ist keine Kreuzung', () => {
    const d = buildDiagram({
      width: 100,
      height: 100,
      strands: [
        { id: 'a', style: 'line', chunks: [{ step: 0, d: 'M0 0 L50 50' }], cross: '' },
        { id: 'b', style: 'line', chunks: [{ step: 0, d: 'M50 50 L100 0' }], cross: '' },
      ],
    });
    expect(d.problems).toEqual([]);
  });

  it('Schritte: nur Bisheriges sichtbar, neu Gezeichnetes animiert, Zeit nach Länge', () => {
    const d = buildDiagram(spec('O'));
    expect(d.steps).toBe(2);
    const s0 = piecesForStep(d, 0);
    expect(s0.every((p) => p.piece.step === 0)).toBe(true);
    const s1 = piecesForStep(d, 1);
    expect(s1.filter((p) => p.isNew).every((p) => p.piece.step === 1)).toBe(true);
    // Schritt 1 ist 50 px lang: bei 160 px/s ≈ 313 ms
    expect(stepDurationMs(d, 1)).toBeGreaterThan(290);
    expect(stepDurationMs(d, 1)).toBeLessThan(330);
    const first = s1.find((p) => p.isNew)?.piece;
    expect(first && animationTiming(first).delayMs).toBe(0);
  });

  it('Zeichenreihenfolge: je Ebene erst Ränder, dann Linien; obere Stücke mit geraden Enden', () => {
    const ops = drawOps(buildDiagram(spec('O')), 1);
    // Ebene 0: Ränder, Linien; Ebene 1: Ränder, Linien
    const runs = ops.map((o) => o.layer).filter((l, k, all) => l !== all[k - 1]);
    expect(runs).toEqual(['halo', 'line', 'halo', 'line']);
    const top = ops.slice(ops.map((o) => o.layer).lastIndexOf('halo'));
    expect(top.every((o) => o.butt)).toBe(true);
    expect(ops.filter((o) => o.timing).length).toBeGreaterThan(0);
  });

  it('Kreuzung erst anheben, wenn beide Teile gezeichnet sind', () => {
    // b kreuzt a erst in Schritt 1 (unten): vorher kein angehobenes Stück auf a
    const d = buildDiagram(spec('U'));
    expect(drawOps(d, 0).some((o) => o.butt && o.layer !== 'halo')).toBe(false);
    expect(drawOps(d, 1).some((o) => o.butt && o.layer !== 'halo')).toBe(true);
    expect(d.crossings[0]?.steps).toEqual([1, 0]);
  });

  it('Ersatzbild: eigene Zeichnung, eingeblendet, eigene Prüfung', () => {
    const d = buildDiagram({ ...spec('O'), scenes: { 2: { ...spec('U') } } });
    expect(d.steps).toBe(3);
    expect(stepDurationMs(d, 2)).toBe(SCENE_FADE_MS);
    expect(drawOps(d, 2).every((o) => o.fade && !o.timing)).toBe(true);
    expect(buildDiagram({ ...spec('O'), scenes: { 2: spec('') } }).problems).toEqual([
      'Bild 3: b: 1 Kreuzungen, Vorgabe nennt 0',
    ]);
  });
});

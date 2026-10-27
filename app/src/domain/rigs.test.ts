import { describe, expect, it } from 'vitest';
import {
  lastTrail,
  pathEnd,
  pathStart,
  rodAngleBefore,
  RIG_DRAW_MS,
  RIG_FADE_MS,
  rigFrame,
  rigProblems,
  rigStepCount,
  rigStepDurationMs,
  stepTrail,
  type RigDiagramSpec,
} from './rigs';

const spec: RigDiagramSpec = {
  width: 100,
  height: 50,
  parts: [
    { id: 'line', step: 0, style: 'line', d: 'M90 10 L10 10' },
    { id: 'weight', step: 0, style: 'weight', d: 'M50 5 L55 10 L50 15 Z' },
    { id: 'hook', step: 1, style: 'hardware', d: 'M10 10 L5 20' },
    {
      id: 'bait',
      step: 1,
      style: 'bait',
      d: 'M10 10 L2 12 L10 14 Z',
      label: { key: 'softBait', x: 10, y: 30 },
    },
  ],
};

describe('Montagen-Zeichenkern (RIG-1)', () => {
  it('zählt Schritte und zeigt bis zum aktuellen Schritt alles, neu nur die Teile des Schritts', () => {
    expect(rigStepCount(spec)).toBe(2);
    expect(rigFrame(spec, 0).map((p) => p.id)).toEqual(['line', 'weight']);
    const f = rigFrame(spec, 1);
    expect(f.map((p) => p.id)).toEqual(['line', 'weight', 'hook', 'bait']);
    expect(f.filter((p) => p.timing).map((p) => p.id)).toEqual(['hook', 'bait']);
  });

  it('neue Teile kommen nacheinander: Linien zeichnen, Flächen blenden ein', () => {
    const [line, weight] = rigFrame(spec, 0);
    expect(line?.timing).toEqual({ delayMs: 0, durationMs: RIG_DRAW_MS });
    expect(weight?.timing).toEqual({ delayMs: RIG_DRAW_MS, durationMs: RIG_FADE_MS });
    expect(rigStepDurationMs(spec, 0)).toBe(RIG_DRAW_MS + RIG_FADE_MS);
  });

  it('meldet doppelte IDs, Punkte außerhalb und Schritte ohne neue Teile', () => {
    expect(rigProblems(spec)).toEqual([]);
    const bad: RigDiagramSpec = {
      ...spec,
      parts: [
        { id: 'a', step: 0, style: 'line', d: 'M0 0 L120 10' },
        { id: 'a', step: 2, style: 'bead', d: 'M5 5 L6 6', label: { key: 'bead', x: 5, y: 80 } },
      ],
    };
    expect(rigProblems(bad)).toEqual([
      'a: Punkt 120 10 außerhalb des Bildes',
      'doppelte ID a',
      'a: Beschriftung außerhalb',
      'Schritt 2 ohne neue Teile',
    ]);
  });

  it('Köderführung: eigene Dauer je Bewegung, Bahn des Schritts, Endlage und Richtung des Köders', () => {
    const spec: RigDiagramSpec = {
      width: 100,
      height: 100,
      lure: true,
      parts: [
        { id: 'ground', step: 0, style: 'context', d: 'M0 90 L100 90' },
        { id: 'sink', step: 0, style: 'trail', d: 'M10 10 L10 80', ms: 1400 },
        { id: 'hop', step: 1, style: 'trail', d: 'M10 80 C10 60 30 50 40 50', ms: 450 },
      ],
    };
    expect(rigFrame(spec, 0).map((p) => p.timing)).toEqual([
      { delayMs: 0, durationMs: RIG_FADE_MS },
      { delayMs: RIG_FADE_MS, durationMs: 1400 },
    ]);
    expect(stepTrail(spec, 1).map((p) => p.id)).toEqual(['hop']);
    expect(lastTrail(spec, 0)?.id).toBe('sink');
    expect(pathEnd('M10 10 L10 80')).toEqual({ x: 10, y: 80, angle: 90 });
    expect(pathEnd('M10 80 C10 60 30 50 40 50')).toEqual({ x: 40, y: 50, angle: 0 });
    expect(pathStart('M10 80 C10 60 30 50 40 50')).toEqual({ x: 10, y: 80 });
    expect(rodAngleBefore(spec, 0)).toBe(30);
  });
});

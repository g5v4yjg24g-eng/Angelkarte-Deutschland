import { describe, expect, it } from 'vitest';
import { clampCrop, imageBox, INITIAL_CROP, MAX_ZOOM, panBy, sourceRect, zoomAt } from './avatarCrop';

const wide = { width: 2000, height: 1000 };
const tall = { width: 1000, height: 3000 };

describe('avatarCrop', () => {
  it('Start: Bild füllt den Rahmen, mittig', () => {
    expect(sourceRect(wide, INITIAL_CROP)).toEqual({ sx: 500, sy: 0, size: 1000 });
    expect(sourceRect(tall, INITIAL_CROP)).toEqual({ sx: 0, sy: 1000, size: 1000 });
    expect(imageBox(wide, INITIAL_CROP)).toEqual({ left: -50, top: 0, width: 200, height: 100 });
  });

  it('Verschieben bleibt im Bild – keine leere Fläche im Ausschnitt', () => {
    const s = panBy(wide, INITIAL_CROP, 5, 5);
    expect(s).toEqual({ zoom: 1, ox: 0.5, oy: 0 });
    expect(sourceRect(wide, s)).toEqual({ sx: 0, sy: 0, size: 1000 });
    expect(sourceRect(wide, panBy(wide, INITIAL_CROP, -9, 0)).sx).toBe(1000);
  });

  it('Zoom ist begrenzt (1 bis MAX_ZOOM) und verkleinert den Ausschnitt', () => {
    expect(clampCrop(wide, { zoom: 0.2, ox: 0, oy: 0 }).zoom).toBe(1);
    expect(clampCrop(wide, { zoom: 99, ox: 0, oy: 0 }).zoom).toBe(MAX_ZOOM);
    expect(clampCrop(wide, { zoom: Number.NaN, ox: 0, oy: 0 }).zoom).toBe(1);
    const z = zoomAt(wide, INITIAL_CROP, 2);
    expect(sourceRect(wide, z)).toEqual({ sx: 750, sy: 250, size: 500 });
  });

  it('Zoom um den Fingerpunkt: der Punkt unter dem Finger bleibt stehen', () => {
    const s = zoomAt(tall, INITIAL_CROP, 2, 0.25, 0.25);
    // Bildpunkt unter (0.25|0.25) vorher und nachher gleich
    const before = sourceRect(tall, INITIAL_CROP);
    const after = sourceRect(tall, s);
    const under = (r: { sx: number; sy: number; size: number }) => ({
      x: r.sx + 0.75 * r.size,
      y: r.sy + 0.75 * r.size,
    });
    expect(under(after).x).toBeCloseTo(under(before).x);
    expect(under(after).y).toBeCloseTo(under(before).y);
  });

  it('Herauszoomen schiebt das Bild zurück, damit der Rahmen bedeckt bleibt', () => {
    const zoomed = panBy(wide, zoomAt(wide, INITIAL_CROP, 3), 0, 1);
    const back = zoomAt(wide, zoomed, 1);
    expect(back.oy).toBe(0);
    const r = sourceRect(wide, back);
    expect(r.sy).toBe(0);
    expect(r.size).toBe(1000);
  });

  it('Ausschnitt hängt nicht von der Rahmengröße ab (Drehen des Geräts)', () => {
    const s = panBy(tall, zoomAt(tall, INITIAL_CROP, 1.5), 0.1, -0.2);
    expect(sourceRect(tall, s)).toEqual(sourceRect(tall, { ...s }));
    const box = imageBox(tall, s);
    expect(box.width).toBeCloseTo(150);
    expect(box.left).toBeLessThanOrEqual(0);
    expect(box.left + box.width).toBeGreaterThanOrEqual(100);
  });
});

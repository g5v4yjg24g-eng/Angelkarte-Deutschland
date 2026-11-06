// Zuschnitt fürs Profilbild (Wunsch Nutzer 2026-11-06, „wie bei Instagram“): quadratischer Ausschnitt 1:1, der
// Kreis entsteht erst in der Anzeige. Rein, ohne DOM. Alle Werte in Einheiten der Rahmenbreite (1 = Rahmen), damit
// der Zuschnitt bei Drehen/Größenänderung gleich bleibt.
// - zoom 1 = Bild füllt den Rahmen genau (kürzere Seite = Rahmen), nie leere Flächen im Ausschnitt.
// - ox/oy = Lage der Bildmitte relativ zur Rahmenmitte.

export const AVATAR_SIZE = 512;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface CropState {
  zoom: number;
  ox: number;
  oy: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export const INITIAL_CROP: CropState = { zoom: 1, ox: 0, oy: 0 };

/** Bildbreite/-höhe in Rahmen-Einheiten bei zoom 1 (kürzere Seite = 1) */
function relSize(img: ImageSize): { w: number; h: number } {
  const min = Math.min(img.width, img.height);
  return { w: img.width / min, h: img.height / min };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Zoom begrenzen und das Bild so schieben, dass der Rahmen immer ganz bedeckt ist */
export function clampCrop(img: ImageSize, s: CropState): CropState {
  const zoom = clamp(Number.isFinite(s.zoom) ? s.zoom : MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  const { w, h } = relSize(img);
  const mx = (w * zoom - 1) / 2;
  const my = (h * zoom - 1) / 2;
  return { zoom, ox: clamp(s.ox || 0, -mx, mx), oy: clamp(s.oy || 0, -my, my) };
}

/** Verschieben um dx/dy (in Rahmen-Einheiten, also Pixel / Rahmenbreite) */
export function panBy(img: ImageSize, s: CropState, dx: number, dy: number): CropState {
  return clampCrop(img, { ...s, ox: s.ox + dx, oy: s.oy + dy });
}

/**
 * Zoomen um einen festen Punkt (px/py relativ zur Rahmenmitte, Rahmen-Einheiten): Der Bildpunkt unter dem Finger
 * bzw. Mauszeiger bleibt dort stehen.
 */
export function zoomAt(img: ImageSize, s: CropState, zoom: number, px = 0, py = 0): CropState {
  const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const f = next / s.zoom;
  return clampCrop(img, { zoom: next, ox: px - (px - s.ox) * f, oy: py - (py - s.oy) * f });
}

/** Lage des Bildes im Rahmen in Prozent der Rahmenbreite (für die Anzeige per CSS) */
export function imageBox(
  img: ImageSize,
  s: CropState,
): { left: number; top: number; width: number; height: number } {
  const { w, h } = relSize(img);
  const width = w * s.zoom;
  const height = h * s.zoom;
  return {
    left: (0.5 + s.ox - width / 2) * 100,
    top: (0.5 + s.oy - height / 2) * 100,
    width: width * 100,
    height: height * 100,
  };
}

/** Ausschnitt in Bildpunkten des Originals – genau das, was im Rahmen zu sehen ist */
export function sourceRect(img: ImageSize, s: CropState): { sx: number; sy: number; size: number } {
  const c = clampCrop(img, s);
  const { w, h } = relSize(img);
  const pxPerUnit = Math.min(img.width, img.height) / c.zoom;
  const left = 0.5 + c.ox - (w * c.zoom) / 2;
  const top = 0.5 + c.oy - (h * c.zoom) / 2;
  const size = pxPerUnit;
  const sx = clamp(-left * pxPerUnit, 0, img.width - size);
  const sy = clamp(-top * pxPerUnit, 0, img.height - size);
  return { sx, sy, size };
}

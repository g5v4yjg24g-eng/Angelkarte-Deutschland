// Fotos (DATA_MODEL §5.4): neu kodiert ohne Metadaten (EXIF inkl. GPS), längste Kante höchstens 1600 px,
// dazu ein Vorschaubild. Neu kodieren entfernt EXIF zuverlässig, weil nur die Bildpunkte übernommen werden.
export const PHOTO_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 320;
export const PHOTO_QUALITY = 0.8;
export const MAX_PHOTOS_PER_CATCH = 6;

/** Zielgröße mit gleichem Seitenverhältnis; kleinere Bilder werden nicht vergrößert. */
export function fitSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error(`Ungültige Bildgröße ${width}×${height}`);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Foto für die Speicherung aufbereiten: Ausrichtung übernehmen, verkleinern, als JPEG neu kodieren.
// Neu kodieren überträgt nur Bildpunkte – EXIF (inkl. GPS, Kameradaten) fällt dabei weg (CLAUDE.md, Datenschutz).
import { fitSize, PHOTO_MAX_EDGE, PHOTO_QUALITY, THUMB_MAX_EDGE } from '../domain/photo';

export interface ProcessedPhoto {
  blob: Blob;
  thumb: Blob;
  mime: 'image/jpeg';
  width: number;
  height: number;
}

export class PhotoReadError extends Error {
  override name = 'PhotoReadError';
}

async function encode(
  bitmap: ImageBitmap,
  maxEdge: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoReadError('Canvas nicht verfügbar');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY),
  );
  if (!blob) throw new PhotoReadError('Bild konnte nicht kodiert werden');
  return { blob, width, height };
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  let bitmap: ImageBitmap;
  try {
    // „from-image": Hochkant-Fotos stehen richtig, obwohl die Ausrichtung nur im (entfernten) EXIF steht
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoReadError('Bild nicht lesbar');
  }
  try {
    const main = await encode(bitmap, PHOTO_MAX_EDGE);
    const thumb = await encode(bitmap, THUMB_MAX_EDGE);
    return { blob: main.blob, thumb: thumb.blob, mime: 'image/jpeg', width: main.width, height: main.height };
  } finally {
    bitmap.close();
  }
}

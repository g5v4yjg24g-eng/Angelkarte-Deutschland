// Profilbild zuschneiden: genau den Ausschnitt aus dem Bearbeitungsfenster als Quadrat (512 × 512) zeichnen und
// danach wie jedes Foto neu kodieren (processPhoto – kein EXIF, also auch kein Standort).
import { AVATAR_SIZE, sourceRect, type CropState, type ImageSize } from '../domain/avatarCrop';
import { PhotoReadError, processPhoto, type ProcessedPhoto } from './processPhoto';

export async function cropPhoto(source: Blob, img: ImageSize, crop: CropState): Promise<ProcessedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoReadError('Bild nicht lesbar');
  }
  try {
    // Maße des Bitmaps statt der übergebenen, falls sie (z. B. durch Ausrichtung) abweichen
    const size = { width: bitmap.width || img.width, height: bitmap.height || img.height };
    const r = sourceRect(size, crop);
    const out = Math.min(AVATAR_SIZE, Math.round(r.size)) || AVATAR_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoReadError('Canvas nicht verfügbar');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, r.sx, r.sy, r.size, r.size, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new PhotoReadError('Bild konnte nicht kodiert werden');
    return await processPhoto(blob);
  } finally {
    bitmap.close();
  }
}

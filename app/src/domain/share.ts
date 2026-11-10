// Teilen (Paket 10): Text für einen eigenen Beitrag – nie mit Fangort oder Koordinaten. Rein, ohne Netz.
import { speciesById } from './species';
import { lengthText } from './profile';

export interface ShareablePost {
  caption?: string | undefined;
  speciesId?: string | undefined;
  lengthCm?: number | undefined;
}

/** „Hecht · 87 cm“ + Text + Hinweis auf Fangpunkt; leere Teile fallen weg */
export function postShareText(p: ShareablePost, footer: string): string {
  const species = p.speciesId ? speciesById(p.speciesId)?.de : undefined;
  const length = p.lengthCm !== undefined ? `${lengthText(p.lengthCm)} cm` : undefined;
  const tag = [species, length].filter(Boolean).join(' · ');
  return [tag, p.caption?.trim(), footer].filter((x) => x && x.length > 0).join('\n\n');
}

/** Dateiname für ein geteiltes Foto: fangpunkt-<datum>-<nr>.<endung> */
export function sharePhotoName(dateIso: string, index: number, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `fangpunkt-${dateIso.slice(0, 10)}-${index + 1}.${ext}`;
}

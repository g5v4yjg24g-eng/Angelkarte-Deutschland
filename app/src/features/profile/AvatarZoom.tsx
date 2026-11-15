// Profilbild groß ansehen (Wunsch Nutzer 2026-11-15): langes Drücken auf ein Profilbild zeigt es groß. Ein Tippen, Escape
// oder der Hintergrund schließt. Das Bild ist dasselbe, das die Person ohnehin für dich freigegeben hat (keine neuen
// Daten). `useAvatarZoom(url)` liefert die Zeiger-Handler fürs Bild und das Fenster zum Einbauen.
import { useState, type ReactNode } from 'react';
import { useLongPress } from '../../lib/useLongPress';
import { AvatarLightbox } from './AvatarLightbox';

export function useAvatarZoom(url: string | undefined): {
  handlers: ReturnType<typeof useLongPress>;
  lightbox: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const handlers = useLongPress(() => setOpen(true), !!url);
  return {
    handlers,
    lightbox: open && url ? <AvatarLightbox url={url} onClose={() => setOpen(false)} /> : null,
  };
}

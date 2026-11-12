// Fotos je Gewässer und Landeswappen (Wikimedia Commons) aus den Gewässerdaten; ohne Fotodatei oder offline
// bleibt es leer und die Ansicht zeigt Platzhalter.
import { useEffect, useState } from 'react';
import type { WaterDataProvider } from '../../ports/waterData';
import type { WaterManifest } from '../../domain/water';
import type { WaterPhoto } from '../../domain/waterPhotos';

export interface WaterMedia {
  photos: Readonly<Record<string, WaterPhoto>>;
  crests: Readonly<Record<string, WaterPhoto>>;
}
const NONE: WaterMedia = { photos: {}, crests: {} };

export function useWaterPhotos(water: WaterDataProvider, manifest: WaterManifest | null): WaterMedia {
  const [media, setMedia] = useState(NONE);
  useEffect(() => {
    if (!manifest?.photos) return;
    let live = true;
    water
      .loadPhotos(manifest)
      .then((f) => live && f && setMedia({ photos: f.items, crests: f.crests ?? {} }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [water, manifest]);
  return media;
}

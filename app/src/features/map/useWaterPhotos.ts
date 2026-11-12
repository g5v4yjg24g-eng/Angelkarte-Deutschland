// Fotos je Gewässer (Wikimedia Commons) aus den Gewässerdaten; ohne Fotodatei oder offline bleibt es leer
// und die Ansicht zeigt den Platzhalter.
import { useEffect, useState } from 'react';
import type { WaterDataProvider } from '../../ports/waterData';
import type { WaterManifest } from '../../domain/water';
import type { WaterPhoto } from '../../domain/waterPhotos';

const NONE: Readonly<Record<string, WaterPhoto>> = {};

export function useWaterPhotos(
  water: WaterDataProvider,
  manifest: WaterManifest | null,
): Readonly<Record<string, WaterPhoto>> {
  const [items, setItems] = useState(NONE);
  useEffect(() => {
    if (!manifest?.photos) return;
    let live = true;
    water
      .loadPhotos(manifest)
      .then((f) => live && f && setItems(f.items))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [water, manifest]);
  return items;
}

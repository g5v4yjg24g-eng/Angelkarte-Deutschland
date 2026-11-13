// Landeswappen je Bundesland (Wikimedia Commons, aus den Gewässerdaten) für Ansichten außerhalb der Karte, z. B. das
// Fang-Blatt auf der Fangbuch-Seite. Ohne Gewässerdaten oder offline bleibt es leer (Ansicht zeigt ein Schild).
import { useEffect, useState } from 'react';
import type { WaterManifest } from '../../domain/water';
import { useProviders } from '../../ports/providersContext';
import { useWaterPhotos } from './useWaterPhotos';

export function useStateCrests() {
  const { water } = useProviders();
  const [manifest, setManifest] = useState<WaterManifest | null>(null);
  useEffect(() => {
    let live = true;
    void water
      .loadManifest()
      .then((m) => live && setManifest(m ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [water]);
  return useWaterPhotos(water, manifest).crests;
}

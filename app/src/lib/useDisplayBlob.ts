// Foto für die Anzeige im Karussell: Eigene Fotos liegen in voller Größe im Speicher (mehrere Megapixel). Das Dekodieren
// und Zeichnen solcher Bilder ließ das Wischen ruckeln. Hier wird je Foto einmal eine mittlere Größe (1080 px, wie im
// Feed) berechnet und gemerkt; ist das Foto nicht größer, bleibt es das Original. Bis dahin: `undefined`.
import { useEffect, useState } from 'react';
import { makeMid } from './processPhoto';

const cache = new Map<string, Promise<Blob>>();

function displayBlob(id: string, blob: Blob): Promise<Blob> {
  let p = cache.get(id);
  if (!p) {
    p = makeMid(blob).then((mid) => mid ?? blob, () => blob);
    cache.set(id, p);
    // nicht unbegrenzt wachsen lassen
    if (cache.size > 60) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

export function useDisplayBlob(id: string, blob: Blob): Blob | undefined {
  const [shown, setShown] = useState<{ id: string; blob: Blob }>();
  useEffect(() => {
    let live = true;
    void displayBlob(id, blob).then((b) => live && setShown({ id, blob: b }));
    return () => {
      live = false;
    };
  }, [id, blob]);
  return shown?.id === id ? shown.blob : undefined;
}

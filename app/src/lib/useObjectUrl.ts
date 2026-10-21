import { useEffect, useState } from 'react';

/** Objekt-URL für ein Blob (z. B. Foto aus IndexedDB); wird beim Wechsel und Abbau freigegeben. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    // Externe Ressource: anlegen und im Cleanup freigeben. useMemo ginge nicht, weil StrictMode den Cleanup
    // probeweise ausführt und die URL dann freigegeben wäre, obwohl das Bild sie noch nutzt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(undefined);
    };
  }, [blob]);
  return url;
}

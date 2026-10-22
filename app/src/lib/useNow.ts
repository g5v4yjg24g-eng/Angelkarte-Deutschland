import { useEffect, useState } from 'react';

/** Aktuelle Zeit, aktualisiert im Abstand `ms` (für laufende Dauern). */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// Gemeldete Inhalte sind für die meldende Person sofort weg (nur auf diesem Gerät gemerkt).
import { useSyncExternalStore } from 'react';
import { hiddenKey, parseHidden, type ReportTarget } from '../../domain/moderation';

const KEY = 'fangpunkt.hidden';
const listeners = new Set<() => void>();
let cache: { raw: string | null; set: Set<string> } | undefined;

function read(): Set<string> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // ohne Speicher bleibt nur die laufende Sitzung
  }
  if (!cache || cache.raw !== raw) cache = { raw, set: parseHidden(raw) };
  return cache.set;
}

export function hideContent(kind: ReportTarget, id: string) {
  const next = new Set(read());
  next.add(hiddenKey(kind, id));
  const raw = JSON.stringify([...next]);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // ohne Speicher: nur bis zum Neuladen ausgeblendet
  }
  cache = { raw, set: next };
  listeners.forEach((l) => l());
}

/** Nach dem Freigeben eines blockierten Kontos wieder anzeigen */
export function unhideContent(kind: ReportTarget, id: string) {
  const next = new Set(read());
  if (!next.delete(hiddenKey(kind, id))) return;
  const raw = JSON.stringify([...next]);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // ohne Speicher: nichts zu tun
  }
  cache = { raw, set: next };
  listeners.forEach((l) => l());
}

export function useHidden(): ReadonlySet<string> {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);
}

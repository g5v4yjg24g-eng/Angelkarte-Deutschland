// Speicher-Status des Browsers (StorageManager). Alle Aufrufe sind optional verfügbar.
export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usage?: number;
  quota?: number;
}

export async function storageStatus(): Promise<StorageStatus> {
  const sm = navigator.storage;
  if (!sm?.persisted) return { supported: false, persisted: false };
  const [persisted, est] = await Promise.all([sm.persisted(), sm.estimate?.().catch(() => undefined)]);
  return {
    supported: true,
    persisted,
    ...(est?.usage !== undefined ? { usage: est.usage } : {}),
    ...(est?.quota !== undefined ? { quota: est.quota } : {}),
  };
}

export async function requestPersist(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}

export function formatBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: n < 10 && i > 0 ? 1 : 0 })} ${units[i]}`;
}

/** Datei herunterladen (funktioniert auch auf iOS als Teilen/Sichern-Dialog). */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  });

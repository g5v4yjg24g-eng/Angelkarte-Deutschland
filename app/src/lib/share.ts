// Teilen und Dateien sichern (Paket 10). In der iPhone-App funktionieren Downloads aus der Webansicht in der Regel
// nicht – dort öffnet sich das Teilen-Menü des Systems („In Dateien sichern“, Mail, Nachrichten …). Im Browser bleibt
// der gewohnte Download. Keine neue Abhängigkeit: Web Share API des Systems [A: in der App am iPhone zu prüfen].
import { Capacitor } from '@capacitor/core';
import { downloadBlob } from './storage';

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

const canShareFiles = (files: File[]) => {
  try {
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files });
  } catch {
    return false;
  }
};

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Datei sichern: in der App über das Teilen-Menü, sonst als Download. Abbrechen im Menü ist kein Fehler. */
export async function saveFile(
  blob: Blob,
  fileName: string,
  native = Capacitor.isNativePlatform(),
): Promise<SaveResult> {
  const file = new File([blob], fileName, { type: blob.type });
  if (native && canShareFiles([file])) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
      // Teilen fehlgeschlagen: wenigstens den Download versuchen
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

/** Kann das Gerät Inhalte teilen? (Knopf nur dann zeigen – am Computer meist nicht) */
export const canShare = () => typeof navigator.share === 'function';

/** Text und – wenn möglich – Fotos über das Teilen-Menü weitergeben. Liefert false bei Abbruch. */
export async function shareContent(input: { title: string; text: string; files?: File[] }): Promise<boolean> {
  const withFiles = input.files?.length && canShareFiles(input.files) ? { files: input.files } : {};
  try {
    await navigator.share({ title: input.title, text: input.text, ...withFiles });
    return true;
  } catch (e) {
    if (isAbort(e)) return false;
    throw e;
  }
}

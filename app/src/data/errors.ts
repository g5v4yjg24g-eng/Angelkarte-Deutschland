// Fehlerarten mit nutzerverständlicher Meldung (ARCHITECTURE §12).
export class ValidationError extends Error {
  override name = 'ValidationError';
  constructor(public issues: string[]) {
    super(`Ungültige Daten: ${issues.join('; ')}`);
  }
}
export class StorageError extends Error {
  override name = 'StorageError';
}

/**
 * Speicher voll? Dexie meldet das direkt, verpackt in `inner` (abgebrochene Transaktion) oder
 * als einzelne Fehler eines BulkError (bulkAdd).
 */
export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; inner?: { name?: string }; failures?: { name?: string }[] };
  return (
    e?.name === 'QuotaExceededError' ||
    e?.inner?.name === 'QuotaExceededError' ||
    !!e?.failures?.some((f) => f?.name === 'QuotaExceededError')
  );
}

/** Übersetzt technische Speicherfehler in verständliche Meldungen. */
export function userMessage(err: unknown): string {
  const e = err as { name?: string; message?: string; inner?: { name?: string } };
  const name = e?.inner?.name ?? e?.name;
  if (isQuotaError(err))
    return 'Der Speicher auf diesem Gerät ist voll. Sichere deine Daten und gib Platz frei (z. B. alte Fotos).';
  if (name === 'ValidationError' || name === 'BackupError') return e.message ?? 'Ungültige Daten.';
  if (name === 'InvalidStateError' || name === 'MissingAPIError')
    return 'Der lokale Speicher ist nicht verfügbar (z. B. im privaten Modus). Daten können nicht gespeichert werden.';
  return 'Speichern fehlgeschlagen. Deine bisherigen Daten sind unverändert.';
}

// Sicherungsdatei lesen und prüfen. Datensätze werden einzeln validiert: Ein kaputter Eintrag
// verhindert nicht den Import der übrigen, wird aber angezeigt (TEST_PLAN BAK-2).
import type { z } from 'zod';
import {
  ENTITY_SCHEMAS,
  PhotoMetaSchema,
  type EntityMap,
  type EntityTable,
  type PhotoMeta,
} from '../schemas';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BackupEnvelopeSchema, checksumOf } from './format';
import { convertLegacy, isLegacyBackup, type LegacyPhoto } from './legacy';

export const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

export interface InvalidRecord {
  table: EntityTable | 'photos';
  index: number;
  id?: string | undefined;
  reason: string;
}

export type Records = { [K in EntityTable]: EntityMap[K][] } & { photos: PhotoMeta[] };

export interface ParsedBackup {
  kind: 'fangpunkt' | 'legacy';
  exportedAt?: string;
  appVersion?: string;
  photosIncluded: boolean;
  records: Records;
  /** Bilddaten aus der Alt-App (DataURLs), bereits dekodiert. */
  legacyPhotos: LegacyPhoto[];
  invalid: InvalidRecord[];
  notes: string[];
}

/** Fehler, der die ganze Datei ablehnt; message ist für Nutzer formuliert. */
export class BackupError extends Error {
  override name = 'BackupError';
}

export const emptyRecords = (): Records => ({
  sessions: [],
  places: [],
  baitPresets: [],
  trips: [],
  tracks: [],
  catches: [],
  photos: [],
});

const describe = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join('.') || 'Datensatz'}: ${i.message}`).join('; ');

export async function parseBackupText(text: string): Promise<ParsedBackup> {
  if (!text.trim()) throw new BackupError('Die Datei ist leer.');
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new BackupError('Die Datei ist keine gültige Sicherung (kein lesbares JSON).');
  }

  if (isLegacyBackup(json)) {
    const l = convertLegacy(json);
    return {
      kind: 'legacy',
      photosIncluded: l.photos.length > 0,
      records: {
        ...emptyRecords(),
        catches: l.catches,
        sessions: l.sessions,
        places: l.places,
        trips: l.trips,
      },
      legacyPhotos: l.photos,
      invalid: l.invalid,
      notes: ['Sicherung der bisherigen Angelkarte-App erkannt.', ...l.notes],
    };
  }

  const fmt = (json as { format?: unknown } | null)?.format;
  if (fmt !== BACKUP_FORMAT)
    throw new BackupError(
      'Unbekanntes Dateiformat. Erwartet wird eine Fangpunkt-Sicherung (.json oder .zip).',
    );
  const env = BackupEnvelopeSchema.safeParse(json);
  if (!env.success)
    throw new BackupError(`Die Sicherung ist unvollständig oder beschädigt (${describe(env.error)}).`);
  if (env.data.formatVersion > BACKUP_FORMAT_VERSION)
    throw new BackupError(
      'Diese Sicherung stammt aus einer neueren Fangpunkt-Version. Bitte aktualisiere die App zuerst.',
    );
  // Prüfsumme über den Datenteil, so wie er in der Datei steht (nicht über die geprüfte Fassung mit Vorgaben)
  if ((await checksumOf((json as { data: unknown }).data)) !== env.data.checksum)
    throw new BackupError(
      'Die Prüfsumme stimmt nicht. Die Datei wurde verändert oder ist beschädigt; es wurde nichts importiert.',
    );

  const records = emptyRecords();
  const invalid: InvalidRecord[] = [];
  for (const table of Object.keys(ENTITY_SCHEMAS) as EntityTable[]) {
    env.data.data[table].forEach((raw, index) => {
      const r = ENTITY_SCHEMAS[table].safeParse(raw);
      if (r.success) (records[table] as unknown[]).push(r.data);
      else invalid.push({ table, index, id: (raw as { id?: string } | null)?.id, reason: describe(r.error) });
    });
  }
  env.data.data.photos.forEach((raw, index) => {
    const r = PhotoMetaSchema.safeParse(raw);
    if (r.success) records.photos.push(r.data);
    else
      invalid.push({
        table: 'photos',
        index,
        id: (raw as { id?: string } | null)?.id,
        reason: describe(r.error),
      });
  });

  return {
    kind: 'fangpunkt',
    exportedAt: env.data.exportedAt,
    appVersion: env.data.appVersion,
    photosIncluded: env.data.photos === 'zip-sidecar',
    records,
    legacyPhotos: [],
    invalid,
    notes: [],
  };
}

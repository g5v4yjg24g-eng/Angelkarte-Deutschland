// Sicherungsformat „fangpunkt-backup" (DATA_MODEL §8). Exportformat und DB-Schema sind getrennt versioniert.
import { z } from 'zod';
import {
  PhotoMetaSchema,
  type BaitPreset,
  type Catch,
  type PhotoMeta,
  type Place,
  type Session,
  type Track,
  type Trip,
  type WaterLink,
} from '../schemas';

export const BACKUP_FORMAT = 'fangpunkt-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupData {
  catches: Catch[];
  places: Place[];
  sessions: Session[];
  baitPresets: BaitPreset[];
  trips: Trip[];
  /** GPS-Routen der Sessions (seit DB v3) */
  tracks: Track[];
  /** eigene Links zur Angelkarte (seit DB v4) */
  waterLinks: WaterLink[];
  /** Nur Metadaten; die Bilddateien liegen im ZIP unter photos/<id>.<ext> oder fehlen (photos: 'omitted'). */
  photos: PhotoMeta[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  schemaVersion: number;
  counts: Record<keyof BackupData, number>;
  photos: 'zip-sidecar' | 'omitted';
  checksum: string;
  data: BackupData;
}

/** Hülle grob prüfen; die Datensätze selbst werden einzeln validiert (parse.ts), damit ein Fehler nicht alles verwirft. */
export const BackupEnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  appVersion: z.string(),
  exportedAt: z.string(),
  schemaVersion: z.number().int().positive(),
  photos: z.enum(['zip-sidecar', 'omitted']),
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  data: z.object({
    catches: z.array(z.unknown()),
    places: z.array(z.unknown()),
    sessions: z.array(z.unknown()),
    baitPresets: z.array(z.unknown()),
    /** seit DB v2; ältere Sicherungen haben keine Termine */
    trips: z.array(z.unknown()).default([]),
    /** seit DB v3; ältere Sicherungen haben keine Routen */
    tracks: z.array(z.unknown()).default([]),
    /** seit DB v4; ältere Sicherungen haben keine eigenen Gewässer-Links */
    waterLinks: z.array(z.unknown()).default([]),
    photos: z.array(z.unknown()),
  }),
});

export { PhotoMetaSchema };

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Prüfsumme über den Datenteil, so wie er in der Datei steht. */
export async function checksumOf(data: unknown): Promise<string> {
  return `sha256:${await sha256Hex(JSON.stringify(data))}`;
}

export async function buildBackup(
  data: BackupData,
  meta: { appVersion: string; exportedAt: string; schemaVersion: number; withPhotos: boolean },
): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: meta.appVersion,
    exportedAt: meta.exportedAt,
    schemaVersion: meta.schemaVersion,
    counts: {
      catches: data.catches.length,
      places: data.places.length,
      sessions: data.sessions.length,
      baitPresets: data.baitPresets.length,
      trips: data.trips.length,
      tracks: data.tracks.length,
      waterLinks: data.waterLinks.length,
      photos: data.photos.length,
    },
    photos: meta.withPhotos ? 'zip-sidecar' : 'omitted',
    checksum: await checksumOf(data),
    data,
  };
}

export const photoFileName = (p: Pick<PhotoMeta, 'id' | 'mime'>) =>
  `photos/${p.id}.${p.mime === 'image/png' ? 'png' : p.mime === 'image/webp' ? 'webp' : 'jpg'}`;

// Fang samt Fotos speichern: alles in einer Transaktion – entweder vollständig oder gar nicht (CAT-5).
import type { Catch, Photo } from '../domain/schemas';
import { PhotoSchema } from '../domain/schemas';
import { newId } from '../domain/id';
import { nowIso } from '../domain/time';
import { weatherStillValid } from '../domain/weather';
import { gaugeStillValid } from '../domain/gauges';
import { getDb, type FangpunktDB } from './db';
import { repo, type NewEntity } from './repository';
import { ValidationError } from './errors';

export interface NewPhoto {
  blob: Blob;
  thumb: Blob;
  mime: Photo['mime'];
  width: number;
  height: number;
}

/**
 * Neuer Eintrag (`input`) oder Änderung (`id` + `changes`). Neue Fotos werden angehängt,
 * `removePhotoIds` werden aus dem Eintrag genommen und endgültig gelöscht.
 */
export async function saveCatch(
  args:
    | { input: NewEntity<Catch>; addPhotos?: NewPhoto[] }
    | { id: string; changes: Partial<NewEntity<Catch>>; addPhotos?: NewPhoto[]; removePhotoIds?: string[] },
  db: FangpunktDB = getDb(),
): Promise<Catch> {
  const r = repo('catches', db);
  return db.transaction('rw', db.catches, db.photos, async () => {
    const catchId = 'id' in args ? args.id : (args.input.id ?? newId());
    const now = nowIso();
    const photos = (args.addPhotos ?? []).map((p) => {
      const row = {
        ...p,
        id: newId(),
        createdAt: now,
        updatedAt: now,
        rev: 0,
        bytes: p.blob.size,
        ownerType: 'catch',
        ownerId: catchId,
      };
      const check = PhotoSchema.safeParse(row);
      if (!check.success)
        throw new ValidationError(check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      return check.data;
    });
    if (photos.length) await db.photos.bulkAdd(photos);
    const addedIds = photos.map((p) => p.id);

    if ('id' in args) {
      const cur = await db.catches.get(args.id);
      if (!cur) throw new Error(`Datensatz ${args.id} nicht gefunden`);
      const removed = new Set(args.removePhotoIds ?? []);
      const photoIds = [...(cur.photoIds ?? []).filter((p) => !removed.has(p)), ...addedIds];
      if (removed.size) await db.photos.bulkDelete([...removed]);
      const next = { ...cur, ...args.changes };
      // Wetter gehört zu Zeit und Ort; ändert sich eins davon, wird es neu geladen.
      const weather = cur.weather && weatherStillValid(cur, next) ? cur.weather : undefined;
      const gauge = cur.gauge && gaugeStillValid(cur, next) ? cur.gauge : undefined;
      return r.update(args.id, {
        ...args.changes,
        weather,
        gauge,
        photoIds: photoIds.length ? photoIds : undefined,
      });
    }
    const existing = args.input.photoIds ?? [];
    return r.create({
      ...args.input,
      id: catchId,
      ...(existing.length + addedIds.length ? { photoIds: [...existing, ...addedIds] } : {}),
    });
  });
}

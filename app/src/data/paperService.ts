// Angelpapiere im Wallet speichern (Wunsch Nutzer 2026-11-16): Papier samt Fotos in einer Transaktion – entweder
// vollständig oder gar nicht. Fotos laufen durch `processPhoto` (kein EXIF) und liegen in der Tabelle `photos`.
import type { Paper } from '../domain/schemas';
import { MAX_PHOTOS_PER_PAPER, PhotoSchema } from '../domain/schemas';
import type { PaperFields } from '../domain/papers';
import { renewIssue } from '../domain/papers';
import { newId } from '../domain/id';
import { nowIso } from '../domain/time';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';
import { ValidationError } from './errors';
import type { NewPhoto } from './catchService';

export type SavePaperArgs =
  | { input: PaperFields; addPhotos?: NewPhoto[] }
  | { id: string; changes: PaperFields; addPhotos?: NewPhoto[]; removePhotoIds?: string[] };

export async function savePaper(args: SavePaperArgs, db: FangpunktDB = getDb()): Promise<Paper> {
  const r = repo('papers', db);
  return db.transaction('rw', db.papers, db.photos, async () => {
    const paperId = 'id' in args ? args.id : newId();
    const now = nowIso();
    const cur = 'id' in args ? await db.papers.get(args.id) : undefined;
    if ('id' in args && !cur) throw new Error(`Datensatz ${args.id} nicht gefunden`);
    const removed = new Set('id' in args ? (args.removePhotoIds ?? []) : []);
    const kept = (cur?.photoIds ?? []).filter((p) => !removed.has(p));
    const add = args.addPhotos ?? [];
    if (kept.length + add.length > MAX_PHOTOS_PER_PAPER)
      throw new ValidationError([`Höchstens ${MAX_PHOTOS_PER_PAPER} Fotos je Papier`]);
    const photos = add.map((p) => {
      const row = {
        ...p,
        id: newId(),
        createdAt: now,
        updatedAt: now,
        rev: 0,
        bytes: p.blob.size,
        ownerType: 'paper',
        ownerId: paperId,
      };
      const check = PhotoSchema.safeParse(row);
      if (!check.success)
        throw new ValidationError(check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      return check.data;
    });
    if (photos.length) await db.photos.bulkAdd(photos);
    if (removed.size) await db.photos.bulkDelete([...removed]);
    const photoIds = [...kept, ...photos.map((p) => p.id)];
    if ('id' in args)
      return r.update(args.id, { ...args.changes, photoIds: photoIds.length ? photoIds : undefined });
    return r.create({ ...args.input, id: paperId, ...(photoIds.length ? { photoIds } : {}) });
  });
}

/** Papier in den Papierkorb (30 Tage, wie alle Einträge); die Fotos bleiben bis dahin erhalten */
export async function removePaper(id: string, db: FangpunktDB = getDb()): Promise<void> {
  await repo('papers', db).remove(id);
}

export async function restorePaper(id: string, db: FangpunktDB = getDb()): Promise<void> {
  await repo('papers', db).restore(id);
}

/** Verlängert: neues Ablaufdatum (nur nach dem bisherigen); die Erinnerung wird dadurch neu geplant */
export async function renewPaper(id: string, until: string, db: FangpunktDB = getDb()): Promise<Paper> {
  const cur = await db.papers.get(id);
  if (!cur || cur.deletedAt) throw new Error(`Datensatz ${id} nicht gefunden`);
  const issue = renewIssue(cur, until);
  if (issue)
    throw new ValidationError([issue === 'invalid' ? 'Ungültiges Datum' : 'Das Datum liegt nicht später']);
  return repo('papers', db).update(id, { validUntil: until });
}

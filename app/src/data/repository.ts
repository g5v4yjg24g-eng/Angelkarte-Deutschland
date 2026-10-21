// Schreib- und Lesezugriffe für Nutzerentitäten: validiert mit Zod, setzt Metadaten, löscht weich (Papierkorb 30 Tage).
import { ENTITY_SCHEMAS, type EntityMap, type EntityTable } from '../domain/schemas';
import { nowIso } from '../domain/time';
import { getDb, type FangpunktDB } from './db';
import { ValidationError } from './errors';
import { newId } from '../domain/id';

export type NewEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'rev' | 'deletedAt'> & { id?: string };
export const TRASH_DAYS = 30;

export function repo<K extends EntityTable>(table: K, db: FangpunktDB = getDb()) {
  type T = EntityMap[K];
  const t = db.table<T, string>(table);
  const schema = ENTITY_SCHEMAS[table];

  function validate(obj: unknown): T {
    const r = schema.safeParse(obj);
    if (!r.success) throw new ValidationError(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    return r.data as T;
  }

  return {
    /** Ohne gelöschte, außer includeDeleted. */
    async list({ includeDeleted = false } = {}): Promise<T[]> {
      const all = await t.toArray();
      return includeDeleted ? all : all.filter((x) => !x.deletedAt);
    },
    get: (id: string) => t.get(id),
    async create(input: NewEntity<T>): Promise<T> {
      const now = nowIso();
      const row = validate({
        ...input,
        id: input.id ?? newId(),
        createdAt: now,
        updatedAt: now,
        rev: 0,
      });
      await t.add(row);
      return row;
    },
    async update(id: string, changes: Partial<NewEntity<T>>): Promise<T> {
      return db.transaction('rw', t, async () => {
        const cur = await t.get(id);
        if (!cur) throw new Error(`Datensatz ${id} nicht gefunden`);
        const row = validate({ ...cur, ...changes, id, updatedAt: nowIso(), rev: cur.rev + 1 });
        await t.put(row);
        return row;
      });
    },
    async remove(id: string): Promise<void> {
      await db.transaction('rw', t, async () => {
        const cur = await t.get(id);
        if (cur && !cur.deletedAt)
          await t.put({ ...cur, deletedAt: nowIso(), updatedAt: nowIso(), rev: cur.rev + 1 });
      });
    },
    async restore(id: string): Promise<void> {
      await db.transaction('rw', t, async () => {
        const cur = await t.get(id);
        if (cur?.deletedAt) {
          const { deletedAt: _d, ...rest } = cur;
          void _d;
          await t.put({ ...rest, updatedAt: nowIso(), rev: cur.rev + 1 } as T);
        }
      });
    },
    /** Endgültig entfernen, was länger als TRASH_DAYS im Papierkorb liegt. */
    async purgeTrash(now = Date.now()): Promise<number> {
      const limit = now - TRASH_DAYS * 864e5;
      const old = (await t.toArray())
        .filter((x) => x.deletedAt && Date.parse(x.deletedAt) < limit)
        .map((x) => x.id);
      await t.bulkDelete(old);
      return old.length;
    },
  };
}

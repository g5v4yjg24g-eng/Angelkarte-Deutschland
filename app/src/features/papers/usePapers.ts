import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import type { Paper } from '../../domain/schemas';

/** Alle Papiere (ohne gelöschte); `undefined` bis die Datenbank geantwortet hat */
export function usePapers(): Paper[] | undefined {
  return useLiveQuery(async () => (await getDb().papers.toArray()).filter((p) => !p.deletedAt), []);
}

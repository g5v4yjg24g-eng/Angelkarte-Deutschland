import 'fake-indexeddb/auto';
import { FangpunktDB, SCHEMA_VERSIONS } from '../data/db';

let n = 0;
/** Frische, isolierte Datenbank je Test. */
export function freshDb(versions = SCHEMA_VERSIONS) {
  return new FangpunktDB(`test-${Date.now()}-${n++}`, versions);
}

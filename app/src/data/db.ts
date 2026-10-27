// Lokale Datenbank (IndexedDB über Dexie). Schemaänderungen nur als neue Version mit Migration + Test (CLAUDE.md).
import Dexie, { type EntityTable as DexieTable } from 'dexie';
import type {
  BaitPreset,
  Catch,
  Photo,
  Place,
  Post,
  Profile,
  Session,
  Track,
  Trip,
  WaterLink,
} from '../domain/schemas';
import type { BackupFile } from '../domain/backup/format';

export interface SettingRow {
  key: string;
  value: unknown;
}

/** Automatische Sicherung vor riskanten Schritten (Import, Migration). Die letzten 2 bleiben erhalten. */
export interface SnapshotRow {
  id: string;
  createdAt: string;
  reason: 'before-import' | 'before-migration';
  backup: BackupFile;
  photoBlobs: Record<string, Blob>;
}

export const DB_NAME = 'fangpunkt';

/** Versionen in Reihenfolge. Neue Versionen werden angehängt, nie verändert. */
export const SCHEMA_VERSIONS: {
  version: number;
  stores: Record<string, string>;
  upgrade?: (tx: import('dexie').Transaction) => Promise<void>;
}[] = [
  {
    version: 1,
    stores: {
      catches: 'id, at, outcome, speciesId, waterId, sessionId, placeId, method, updatedAt, deletedAt',
      places: 'id, type, waterId, updatedAt, deletedAt',
      sessions: 'id, startAt, waterId, updatedAt, deletedAt',
      baitPresets: 'id, updatedAt, deletedAt',
      photos: 'id, ownerId, updatedAt',
      settings: 'key',
      snapshots: 'id, createdAt',
    },
  },
  // v2 (2026-10-22): Angelkalender; neue Tabelle, vorhandene Daten bleiben unverändert
  { version: 2, stores: { trips: 'id, date, updatedAt, deletedAt' } },
  // v3 (2026-10-23): GPS-Routen der Sessions (Session-Rückblick); neue Tabelle, vorhandene Daten bleiben unverändert
  { version: 3, stores: { tracks: 'id, sessionId, updatedAt, deletedAt' } },
  // v4 (2026-10-25): eigene Links zur Angelkarte je Gewässer; neue Tabelle, vorhandene Daten bleiben unverändert
  { version: 4, stores: { waterLinks: 'id, waterId, updatedAt, deletedAt' } },
  // v5 (2026-10-27): Profilseite – eigenes Profil und Beiträge; neue Tabellen, vorhandene Daten bleiben unverändert
  {
    version: 5,
    stores: { profiles: 'id, updatedAt, deletedAt', posts: 'id, createdAt, catchId, updatedAt, deletedAt' },
  },
];
export const SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1]?.version ?? 1;

export class FangpunktDB extends Dexie {
  catches!: DexieTable<Catch, 'id'>;
  places!: DexieTable<Place, 'id'>;
  sessions!: DexieTable<Session, 'id'>;
  baitPresets!: DexieTable<BaitPreset, 'id'>;
  photos!: DexieTable<Photo, 'id'>;
  trips!: DexieTable<Trip, 'id'>;
  tracks!: DexieTable<Track, 'id'>;
  waterLinks!: DexieTable<WaterLink, 'id'>;
  profiles!: DexieTable<Profile, 'id'>;
  posts!: DexieTable<Post, 'id'>;
  settings!: DexieTable<SettingRow, 'key'>;
  snapshots!: DexieTable<SnapshotRow, 'id'>;

  constructor(name = DB_NAME, versions = SCHEMA_VERSIONS) {
    super(name);
    for (const v of versions) {
      const s = this.version(v.version).stores(v.stores);
      if (v.upgrade) s.upgrade(v.upgrade);
    }
  }
}

let instance: FangpunktDB | undefined;
export function getDb(): FangpunktDB {
  instance ??= new FangpunktDB();
  return instance;
}
/** Nur für Tests. */
export function setDb(db: FangpunktDB | undefined) {
  instance = db;
}

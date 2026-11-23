import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { changesSince } from '../../data/changes';
import { getSetting } from '../../data/settings';
import { backupReminderDue } from '../../domain/backup/reminder';
import { cloudBackupFresh } from '../../domain/cloudBackup';
import { storedUserId } from '../badges/badgeStore';

/** Live-Zustand für Sicherung und Erinnerung (aktualisiert sich bei jeder DB-Änderung). */
export function useBackupState() {
  return useLiveQuery(async () => {
    const db = getDb();
    const [lastBackupAt, snoozedUntil, cloud] = await Promise.all([
      getSetting('lastBackupAt'),
      getSetting('backupReminderSnoozedUntil'),
      getSetting('cloudBackup'),
    ]);
    const uid = storedUserId();
    const changes = await changesSince(lastBackupAt);
    const counts = {
      catches: await db.catches.filter((c) => !c.deletedAt).count(),
      places: await db.places.filter((p) => !p.deletedAt).count(),
      sessions: await db.sessions.filter((s) => !s.deletedAt).count(),
      trips: await db.trips.filter((t) => !t.deletedAt).count(),
      photos: await db.photos.count(),
    };
    const snapshot = await db.snapshots.orderBy('createdAt').last();
    return {
      lastBackupAt,
      changes: changes.count,
      counts,
      lastSnapshot: snapshot ? { id: snapshot.id, createdAt: snapshot.createdAt } : undefined,
      reminderDue: backupReminderDue({
        changes: changes.count,
        oldestChange: changes.oldest,
        lastBackupAt,
        snoozedUntil,
        cloudFresh: cloudBackupFresh(uid ? cloud?.[uid] : undefined, Date.now()),
        now: Date.now(),
      }),
    };
  });
}

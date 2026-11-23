// Cloud-Sicherung im Hintergrund (BACKUP_PLAN.md, Etappe 3): nur angemeldet, online und nach der Zustimmung
// (Einstellung je Konto, die Oberfläche folgt in Etappe 4). Höchstens ein Lauf je Stunde, nach Fehlern mit wachsender
// Pause; über mehrere Tabs läuft immer nur ein Lauf (Web Locks, wo vorhanden).
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProviders } from '../../ports/providersContext';
import { useOnline } from '../../lib/useOnline';
import { getSetting } from '../../data/settings';
import { runCloudBackup, withCloudLock } from '../../data/cloudBackupService';
import { nextCloudRun } from '../../domain/cloudBackup';
import { useStoredUserId } from '../badges/badgeStore';

export function CloudBackupSync() {
  const { account } = useProviders();
  const online = useOnline();
  const stored = useStoredUserId();
  const userId = account.enabled ? stored : undefined;
  const all = useLiveQuery(() => getSetting('cloudBackup'), []);
  const cloud = userId ? all?.[userId] : undefined;
  const enabled = cloud?.enabled === true;
  const lastRunAt = cloud?.lastRunAt;
  const lastError = cloud?.lastError;
  const retries = cloud?.retries;

  useEffect(() => {
    if (!userId || !online || !cloud || !enabled) return;
    const wait = Math.max(0, nextCloudRun(cloud, Date.now()) - Date.now());
    const timer = setTimeout(
      () => {
        // nach dem Lauf ändert sich der gespeicherte Stand (lastRunAt) und plant den nächsten
        void withCloudLock(() => runCloudBackup(account, userId)).catch(() => undefined);
      },
      Math.min(wait, 2 ** 31 - 1),
    );
    return () => clearTimeout(timer);
    // `cloud` selbst ändert sich bei jedem Zwischenstand; entscheidend sind nur diese Werte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, online, enabled, lastRunAt, lastError, retries, account]);

  return null;
}

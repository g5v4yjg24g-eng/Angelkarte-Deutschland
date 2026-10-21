import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { exportBackup, restoreSnapshot } from '../../data/backupService';
import { userMessage } from '../../data/errors';
import {
  downloadBlob,
  formatBytes,
  formatDateTime,
  requestPersist,
  storageStatus,
  type StorageStatus,
} from '../../lib/storage';
import { ImportPanel } from './ImportPanel';
import { useBackupState } from './useBackupState';
import styles from './BackupPage.module.css';

export function BackupPage() {
  const state = useBackupState();
  const [storage, setStorage] = useState<StorageStatus>();
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'warning'; text: string }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void storageStatus().then(setStorage);
  }, [state?.counts.photos]);

  async function onExport(withPhotos: boolean) {
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await exportBackup({ withPhotos });
      downloadBlob(r.blob, r.fileName);
      setMessage({ tone: 'success', text: de.backup.exportDone(r.fileName) });
    } catch (e) {
      setMessage({ tone: 'error', text: userMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onPersist() {
    const ok = await requestPersist();
    setStorage(await storageStatus());
    if (!ok) setMessage({ tone: 'warning', text: de.backup.persistDenied });
  }

  async function onUndo(id: string) {
    if (!window.confirm(de.backup.undoConfirm)) return;
    try {
      await restoreSnapshot(id);
      setMessage({ tone: 'success', text: de.backup.undoDone });
    } catch (e) {
      setMessage({ tone: 'error', text: userMessage(e) });
    }
  }

  const snapshot = state?.lastSnapshot;
  return (
    <Page title={de.backup.title} back="/mehr">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Section title={de.backup.storageTitle}>
        <p>{de.backup.storageIntro}</p>
        {state && <p className="tabular">{de.backup.counts(state.counts)}</p>}
        {storage && (
          <div className={styles.row}>
            <p>
              {!storage.supported
                ? de.backup.persistUnsupported
                : storage.persisted
                  ? de.backup.persisted
                  : de.backup.notPersisted}
              {storage.usage !== undefined && storage.quota !== undefined && (
                <span className="muted tabular">
                  {' '}
                  · {de.backup.usage(formatBytes(storage.usage), formatBytes(storage.quota))}
                </span>
              )}
            </p>
            {storage.supported && !storage.persisted && (
              <Button variant="secondary" onClick={() => void onPersist()}>
                {de.backup.persistAction}
              </Button>
            )}
          </div>
        )}
      </Section>

      <Section title={de.backup.exportTitle}>
        {state && (
          <p>
            {state.lastBackupAt
              ? de.backup.lastBackup(formatDateTime(state.lastBackupAt))
              : de.backup.neverBackedUp}
            {state.changes > 0 && <span className="muted"> · {de.backup.changes(state.changes)}</span>}
          </p>
        )}
        <div className={styles.actions}>
          <Button onClick={() => void onExport(true)} disabled={busy}>
            {de.backup.exportZip}
          </Button>
          <Button variant="secondary" onClick={() => void onExport(false)} disabled={busy}>
            {de.backup.exportJson}
          </Button>
        </div>
        <p className="muted">{de.backup.exportHint}</p>
      </Section>

      <Section title={de.backup.importTitle}>
        <ImportPanel />
      </Section>

      {snapshot && (
        <Section title={de.backup.undoTitle}>
          <p className="muted">{de.backup.undoHint(formatDateTime(snapshot.createdAt))}</p>
          <div>
            <Button variant="secondary" onClick={() => void onUndo(snapshot.id)}>
              {de.backup.undoAction}
            </Button>
          </div>
        </Section>
      )}
    </Page>
  );
}

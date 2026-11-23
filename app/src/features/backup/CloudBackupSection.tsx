// Cloud-Sicherung unter Mehr → Daten & Sicherung: Schalter, Stand, Verbrauch, „Jetzt sichern“ und Löschen.
// Wiederherstellen steht im Importbereich (gleiche Vorschau wie bei einer Datei).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Switch } from '../../design/components/Switch';
import { useProviders } from '../../ports/providersContext';
import { getSetting } from '../../data/settings';
import {
  deleteCloudBackup,
  runCloudBackup,
  setCloudBackupEnabled,
  withCloudLock,
} from '../../data/cloudBackupService';
import { userMessage } from '../../data/errors';
import { quotaState, type BackupUsage } from '../../domain/cloudBackup';
import { formatBytes, formatDateTime } from '../../lib/storage';
import { useStoredUserId } from '../badges/badgeStore';
import styles from './BackupPage.module.css';

const t = de.cloudBackup;

export function CloudBackupSection() {
  const { account } = useProviders();
  const navigate = useNavigate();
  const userId = useStoredUserId();
  const all = useLiveQuery(async () => ({ map: await getSetting('cloudBackup') }), []);
  const [usage, setUsage] = useState<BackupUsage>();
  const [busy, setBusy] = useState<'run' | 'delete'>();
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'warning'; text: string }>();
  const st = userId ? all?.map?.[userId] : undefined;
  const lastOkAt = st?.lastOkAt;

  useEffect(() => {
    if (!account.enabled || !userId || !st?.enabled) return;
    let alive = true;
    void account
      .backupUsage()
      .then((u) => alive && setUsage(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [account, userId, st?.enabled, lastOkAt]);

  if (!account.enabled) return null;
  if (!userId)
    return (
      <Section title={t.title}>
        <p>{t.needAccount}</p>
        <div>
          <Button variant="secondary" onClick={() => void navigate('/mehr/konto')}>
            {t.signIn}
          </Button>
        </div>
      </Section>
    );

  async function onRun() {
    if (!userId) return;
    setBusy('run');
    setMessage(undefined);
    try {
      const r = await withCloudLock(() => runCloudBackup(account, userId), true);
      if (!r || r.status === 'failed') setMessage({ tone: 'error', text: t.failed });
      else if (r.status === 'quota') setMessage({ tone: 'warning', text: t.quota });
      else
        setMessage({
          tone: 'success',
          text: r.more ? t.backupMore : t.backupDone(r.uploaded + r.deleted),
        });
    } catch (e) {
      setMessage({ tone: 'error', text: userMessage(e) });
    } finally {
      setBusy(undefined);
    }
  }

  async function onDelete() {
    if (!userId || !window.confirm(t.deleteConfirm)) return;
    setBusy('delete');
    setMessage(undefined);
    try {
      await deleteCloudBackup(account, userId);
      setUsage(undefined);
      setMessage({ tone: 'success', text: t.deleted });
    } catch (e) {
      setMessage({ tone: 'error', text: userMessage(e) });
    } finally {
      setBusy(undefined);
    }
  }

  const enabled = st?.enabled === true;
  const quota = usage ? quotaState(usage.fileBytes + usage.dataBytes, usage.limitBytes) : undefined;
  return (
    <Section title={t.title}>
      <div className={styles.row}>
        <p>{t.what}</p>
        <Switch
          checked={enabled}
          label={t.switchLabel}
          onChange={(next) => void setCloudBackupEnabled(userId, next)}
        />
      </div>
      {enabled ? (
        <>
          <p className="tabular">
            {st?.lastOkAt ? t.last(formatDateTime(st.lastOkAt)) : st?.lastError ? t.never : t.pending}
            {usage && (
              <span className="muted">
                {' · '}
                {t.usage(formatBytes(usage.fileBytes + usage.dataBytes), formatBytes(usage.limitBytes))}
              </span>
            )}
          </p>
          {st?.lastError === 'quota' || quota?.level === 'full' ? (
            <Notice tone="warning">{t.quota}</Notice>
          ) : st?.lastError === 'failed' ? (
            <Notice tone="warning">{t.failed}</Notice>
          ) : null}
          {(st?.skipped ?? 0) > 0 && <Notice>{t.skipped(st?.skipped ?? 0)}</Notice>}
        </>
      ) : (
        st?.consentAt && <p className="muted">{t.off}</p>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className={styles.actions}>
        {enabled && (
          <Button onClick={() => void onRun()} disabled={busy !== undefined}>
            {busy === 'run' ? t.backingUp : t.backupNow}
          </Button>
        )}
        {(enabled || st?.consentAt) && (
          <Button variant="secondary" onClick={() => void onDelete()} disabled={busy !== undefined}>
            {t.delete}
          </Button>
        )}
      </div>
    </Section>
  );
}

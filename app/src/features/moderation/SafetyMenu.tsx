// „…“ an fremden Inhalten (Etappe 5): Melden mit Grund und Blockieren. Apple verlangt beides für Apps,
// in denen Nutzer Inhalte teilen. Meldungen gehen an moderation@fangpunkt.com (Server, Edge Function).
import { useState, type FormEvent } from 'react';
import { de } from '../../i18n/de';
import { Button, IconButton } from '../../design/components/Button';
import { TextArea } from '../../design/components/Field';
import { Notice } from '../../design/components/Notice';
import { Sheet } from '../../design/components/Sheet';
import { MoreIcon } from '../../design/icons';
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  reportInput,
  type ReportReason,
  type ReportTarget,
} from '../../domain/moderation';
import { useProviders } from '../../ports/providersContext';
import { hideContent } from './hiddenStore';
import { moderationErrorText } from './moderationErrors';
import styles from './Moderation.module.css';

const t = de.moderation;

export function SafetyMenu({
  kind,
  targetId,
  owner,
  onDone,
  extra,
}: {
  kind: ReportTarget;
  targetId: string;
  owner: { id: string; name: string };
  /** Meldung gesendet oder blockiert – Text für einen Hinweis */
  onDone: (message: string, action: 'reported' | 'blocked') => void;
  /** weitere Einträge vor „Melden“ (z. B. „Als Follower entfernen“); das Blatt schließt, dann läuft die Aktion */
  extra?: readonly { label: string; onSelect: () => void }[];
}) {
  const { account } = useProviders();
  const [step, setStep] = useState<'closed' | 'menu' | 'report' | 'block'>('closed');
  const [reason, setReason] = useState<ReportReason>();
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const close = () => {
    setStep('closed');
    setReason(undefined);
    setDetails('');
    setError(undefined);
  };

  const run = async (fn: () => Promise<void>, message: string, action: 'reported' | 'blocked') => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      close();
      onDone(message, action);
    } catch (e) {
      setError(moderationErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReport = (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    void run(
      async () => {
        await account.report(reportInput(kind, targetId, owner.id, reason, details));
        hideContent(kind, targetId);
      },
      t.reported,
      'reported',
    );
  };

  const title =
    step === 'report' ? t.reportTitle : step === 'block' ? t.blockTitle(owner.name) : t.optionsTitle;

  return (
    <>
      <IconButton
        label={t.options(owner.name)}
        icon={<MoreIcon size={20} />}
        onClick={() => setStep('menu')}
      />
      <Sheet open={step !== 'closed'} title={title} onClose={close}>
        {step === 'menu' && (
          <div className={styles.menu}>
            {extra?.map((e) => (
              <Button
                key={e.label}
                variant="secondary"
                onClick={() => {
                  close();
                  e.onSelect();
                }}
              >
                {e.label}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setStep('report')}>
              {t.report}
            </Button>
            <Button variant="danger" onClick={() => setStep('block')}>
              {t.block(owner.name)}
            </Button>
          </div>
        )}
        {step === 'report' && (
          <form className={styles.form} onSubmit={submitReport}>
            <fieldset className={styles.reasons}>
              <legend>{t.reportWhat[kind]}</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className={styles.reason}>
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <span>{t.reasons[r]}</span>
                </label>
              ))}
            </fieldset>
            <TextArea
              label={t.detailsLabel}
              hint={t.detailsHint}
              maxLength={REPORT_DETAILS_MAX}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {error && <Notice tone="error">{error}</Notice>}
            <div className={styles.actions}>
              <Button variant="secondary" onClick={close}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={busy || !reason}>
                {busy ? t.sending : t.send}
              </Button>
            </div>
          </form>
        )}
        {step === 'block' && (
          <div className={styles.form}>
            <p>{t.blockText}</p>
            {error && <Notice tone="error">{error}</Notice>}
            <div className={styles.actions}>
              <Button variant="secondary" onClick={close}>
                {t.cancel}
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void run(
                    async () => {
                      await account.blockUser(owner.id);
                      hideContent('user', owner.id);
                    },
                    t.blocked(owner.name),
                    'blocked',
                  )
                }
              >
                {t.blockConfirm}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

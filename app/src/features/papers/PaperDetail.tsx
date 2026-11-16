// Ein Papier ansehen (Sheet): Angaben, Fotos, „Verlängert“ (neues Ablaufdatum), Bearbeiten, Löschen.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Sheet } from '../../design/components/Sheet';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextField } from '../../design/components/Field';
import { renewPaper } from '../../data/paperService';
import { userMessage } from '../../data/errors';
import { paperState, remindEnabled, renewIssue } from '../../domain/papers';
import type { Paper } from '../../domain/schemas';
import { CatchPhotos } from '../catches/CatchPhotos';
import { formatDay, stateText } from './paperText';
import styles from './Papers.module.css';

const t = de.papers;
const d = de.papers.detail;

export function PaperDetail({
  paper,
  today,
  onClose,
  onEdit,
  onRemove,
  onRenewed,
}: {
  paper: Paper;
  today: string;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onRenewed: () => void;
}) {
  const [renewing, setRenewing] = useState(false);
  const [until, setUntil] = useState('');
  const [error, setError] = useState<string>();
  const state = paperState(paper, today);

  async function renew(e: React.FormEvent) {
    e.preventDefault();
    const issue = renewIssue(paper, until);
    if (issue) return setError(d.renewErrors[issue]);
    try {
      await renewPaper(paper.id, until);
      setRenewing(false);
      setUntil('');
      setError(undefined);
      onRenewed();
    } catch (x) {
      setError(userMessage(x));
    }
  }

  const period = paper.validUntil
    ? [paper.validFrom && t.validFrom(formatDay(paper.validFrom)), t.validUntil(formatDay(paper.validUntil))]
        .filter(Boolean)
        .join(' · ')
    : t.unlimited;

  return (
    <Sheet
      open
      title={paper.title}
      onClose={onClose}
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onEdit}>
            {d.edit}
          </Button>
          <Button variant="danger" onClick={onRemove}>
            {d.remove}
          </Button>
        </div>
      }
    >
      <dl className={styles.facts}>
        <div>
          <dt>{t.form.kind}</dt>
          <dd>{t.kinds[paper.kind]}</dd>
        </div>
        <div>
          <dt>{d.period}</dt>
          <dd>
            {period}
            {state.kind !== 'unlimited' && ` – ${stateText(state)}`}
          </dd>
        </div>
        {paper.issuer && (
          <div>
            <dt>{d.issuer}</dt>
            <dd>{paper.issuer}</dd>
          </div>
        )}
        {paper.number && (
          <div>
            <dt>{d.number}</dt>
            <dd>{paper.number}</dd>
          </div>
        )}
        {paper.validUntil && (
          <div>
            <dt>{d.remind}</dt>
            <dd>{remindEnabled(paper) ? d.remindOn : d.remindOff}</dd>
          </div>
        )}
        {paper.notes && (
          <div>
            <dt>{d.notes}</dt>
            <dd>{paper.notes}</dd>
          </div>
        )}
      </dl>
      {paper.photoIds?.length ? <CatchPhotos ids={paper.photoIds} /> : null}
      {paper.validUntil &&
        (renewing ? (
          <form className={styles.renew} onSubmit={(e) => void renew(e)} noValidate>
            <TextField
              label={d.renewTitle}
              type="date"
              value={until}
              onChange={(e) => {
                setUntil(e.target.value);
                setError(undefined);
              }}
              {...(error ? { error } : {})}
              autoFocus
            />
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setRenewing(false)}>
                {t.form.cancel}
              </Button>
              <Button type="submit">{d.renewSave}</Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setRenewing(true)}>{d.renew}</Button>
        ))}
      {!renewing && error && <Notice tone="error">{error}</Notice>}
    </Sheet>
  );
}

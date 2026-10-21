// Eine Session: Zeiten, Dauer, Einträge (außerhalb der Zeit markiert), beenden, korrigieren (SES-3), bearbeiten.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextArea, TextField } from '../../design/components/Field';
import { getDb } from '../../data/db';
import { repo } from '../../data/repository';
import { endSession } from '../../data/sessionService';
import { userMessage } from '../../data/errors';
import type { Session } from '../../domain/schemas';
import {
  durationMs,
  formatDuration,
  isRunning,
  looksForgotten,
  sessionCatches,
  suggestedEnd,
} from '../../domain/session';
import { localToZonedIso, toZonedIso } from '../../domain/time';
import { formatDateTime } from '../../lib/storage';
import { useNow } from '../../lib/useNow';
import { catchTitle } from '../catches/catchText';
import styles from './Sessions.module.css';

const t = de.sessions;

/** Korrektur des Endes einer vergessenen Session (SES-3). */
function CorrectEnd({
  session,
  suggested,
  onDone,
}: {
  session: Session;
  suggested: number;
  onDone: (ended: Session) => void;
}) {
  const iso = toZonedIso(suggested, session.tz);
  const [date, setDate] = useState(iso.slice(0, 10));
  const [time, setTime] = useState(iso.slice(11, 16));
  const [error, setError] = useState<string>();
  async function save() {
    setError(undefined);
    let end: number;
    // Unveränderter Vorschlag: genau übernehmen (die Felder kennen nur Minuten)
    if (date === iso.slice(0, 10) && time === iso.slice(11, 16)) end = suggested;
    else
      try {
        end = Date.parse(localToZonedIso(date, time, session.tz));
      } catch {
        return setError(de.catchForm.errors.date);
      }
    if (end < Date.parse(session.startAt)) return setError(t.endBeforeStart);
    try {
      onDone(await endSession(session.id, end));
    } catch (err) {
      setError(userMessage(err));
    }
  }
  return (
    <Notice tone="warning">
      <div className={styles.stack}>
        <p>
          <strong>{t.forgottenTitle}</strong> {t.forgottenText}
        </p>
        <div className={styles.pair}>
          <TextField label={t.endDate} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t.endTime} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <Button onClick={() => void save()}>{t.setEnd}</Button>
        </div>
      </div>
    </Notice>
  );
}

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const s = await db.sessions.get(id);
    return { session: s ?? null, catches: s ? await db.catches.where('sessionId').equals(id).toArray() : [] };
  }, [id]);
  const [title, setTitle] = useState<string>();
  const [notes, setNotes] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [keepRunning, setKeepRunning] = useState(false);

  if (!data)
    return (
      <Page title={t.detailTitle} back="/fangbuch/sessions">
        <Notice>{de.catches.loading}</Notice>
      </Page>
    );
  const s = data.session;
  if (!s || s.deletedAt)
    return (
      <Page title={t.detailTitle} back="/fangbuch/sessions">
        <Notice>{t.notFound}</Notice>
      </Page>
    );

  const entries = sessionCatches(s, data.catches);
  const running = isRunning(s);
  const forgotten = looksForgotten(s, now) && !keepRunning;
  const duration = formatDuration(durationMs(s, now));

  async function saveMeta(session: Session) {
    setError(undefined);
    try {
      await repo('sessions').update(session.id, {
        title: (title ?? session.title ?? '').trim() || undefined,
        notes: (notes ?? session.notes ?? '').trim() || undefined,
      });
      setMessage(t.saved);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  return (
    <Page title={s.title ?? t.detailTitle} back="/fangbuch/sessions">
      <div className={styles.stack}>
        {forgotten && (
          <>
            <CorrectEnd
              session={s}
              suggested={suggestedEnd(s, data.catches)}
              onDone={(ended) => setMessage(t.ended(formatDuration(durationMs(ended, now))))}
            />
            <div>
              <Button variant="secondary" onClick={() => setKeepRunning(true)}>
                {t.stillRunning}
              </Button>
            </div>
          </>
        )}
        <dl className={styles.facts}>
          <div>
            <dt>{t.from}</dt>
            <dd className="tabular">{formatDateTime(s.startAt)}</dd>
          </div>
          <div>
            <dt>{t.to}</dt>
            <dd className="tabular">{s.endAt ? formatDateTime(s.endAt) : t.running}</dd>
          </div>
          <div>
            <dt>{t.duration}</dt>
            <dd className="tabular">{duration}</dd>
          </div>
        </dl>
        {running && !forgotten && (
          <div className={styles.actions}>
            <Button
              onClick={() =>
                void endSession(s.id)
                  .then((ended) => setMessage(t.ended(formatDuration(durationMs(ended, Date.now())))))
                  .catch((err: unknown) => setError(userMessage(err)))
              }
            >
              {t.end}
            </Button>
          </div>
        )}
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <Section title={`${t.entries} (${entries.length})`}>
          {entries.length === 0 ? (
            <p className="muted">{t.noEntries}</p>
          ) : (
            <ul className={styles.list}>
              {entries.map(({ item, outside }) => (
                <li key={item.id}>
                  <Link to={`/fangbuch/${item.id}`} className={styles.row}>
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{catchTitle(item)}</span>
                      <span className="muted tabular">{formatDateTime(item.at)}</span>
                      {outside && <span className={styles.outside}>{t.outside}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section>
          <form
            className={styles.stack}
            onSubmit={(e) => {
              e.preventDefault();
              void saveMeta(s);
            }}
          >
            <TextField
              label={t.title_}
              placeholder={t.titlePlaceholder}
              maxLength={120}
              value={title ?? s.title ?? ''}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextArea
              label={t.notes}
              maxLength={4000}
              value={notes ?? s.notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className={styles.actions}>
              <Button type="submit">{t.save}</Button>
              <Button
                variant="danger"
                onClick={() =>
                  void repo('sessions')
                    .remove(s.id)
                    .then(() => navigate('/fangbuch/sessions'))
                }
              >
                {t.delete}
              </Button>
            </div>
          </form>
        </Section>
      </div>
    </Page>
  );
}

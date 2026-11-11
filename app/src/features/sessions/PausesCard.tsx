// Pausen in der Session-Ansicht (Vorlage Nutzer 2026-11-11): Karte mit Stand und „Pause nachtragen“; das Formular
// öffnet im Blatt. Pausen zählen nicht zur Angelzeit (Logik in domain/session.ts).
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { TextField } from '../../design/components/Field';
import { Sheet } from '../../design/components/Sheet';
import { CupIcon, PlusIcon } from '../../design/icons';
import { addPause, removePause } from '../../data/sessionService';
import { userMessage } from '../../data/errors';
import type { Session } from '../../domain/schemas';
import { formatDuration, pauseIssue, pauseMs, withPause } from '../../domain/session';
import { localToZonedIso, toZonedIso } from '../../domain/time';
import styles from './Sessions.module.css';

const t = de.sessions;
const clock = (iso: string) => iso.slice(11, 16);

export function PausesCard({ session, now }: { session: Session; now: number }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string>();
  const pauses = session.pauses ?? [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    let fromMs: number, toMs: number;
    try {
      fromMs = Date.parse(localToZonedIso(from.slice(0, 10), from.slice(11, 16), session.tz));
      toMs = Date.parse(localToZonedIso(to.slice(0, 10), to.slice(11, 16), session.tz));
    } catch {
      return setError(t.pauseIssues.date);
    }
    const candidate = {
      ...session,
      pauses: withPause(pauses, {
        from: toZonedIso(fromMs, session.tz),
        to: toZonedIso(toMs, session.tz),
      }),
    };
    // Laufende Session: Pause darf nicht in der Zukunft enden
    const issue = pauseIssue(candidate) ?? (!session.endAt && toMs > now ? 'outside' : undefined);
    if (issue) return setError(t.pauseIssues[issue]);
    try {
      await addPause(session.id, fromMs, toMs);
      setFrom('');
      setTo('');
      setOpen(false);
    } catch (err) {
      setError(userMessage(err));
    }
  }

  return (
    <section className={styles.card} aria-label={t.pauses}>
      <div className={styles.cardRow}>
        <span className={styles.cardIcon}>
          <CupIcon size={24} />
        </span>
        <span className={styles.rowText}>
          <h3 className={styles.rowTitle}>{t.pauses}</h3>
          <span className={styles.rowHint}>
            {pauses.length === 0
              ? t.pausesNone
              : t.pausesSum(pauses.length, formatDuration(pauseMs(session, now)))}
          </span>
        </span>
        <Button
          variant="secondary"
          className={styles.smallButton ?? ''}
          icon={<PlusIcon size={16} />}
          onClick={() => {
            setError(undefined);
            setOpen(true);
          }}
        >
          {t.addPause}
        </Button>
      </div>
      {pauses.length > 0 && (
        <ul className={styles.pauseList}>
          {pauses.map((p, i) => (
            <li key={p.from} className={styles.pauseRow}>
              <span className="tabular">
                {p.to
                  ? t.pauseRow(
                      clock(p.from),
                      clock(p.to),
                      formatDuration(pauseMs({ startAt: session.startAt, pauses: [p] }, now)),
                    )
                  : t.pauseOpen(clock(p.from))}
              </span>
              <Button
                variant="ghost"
                aria-label={`${t.removePause} ${clock(p.from)}`}
                onClick={() =>
                  void removePause(session.id, i).catch((err: unknown) => setError(userMessage(err)))
                }
              >
                {t.removePause}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open} title={t.addPause} onClose={() => setOpen(false)}>
        <form className={styles.stack} onSubmit={(e) => void add(e)} noValidate>
          <TextField
            label={t.pauseFrom}
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            label={t.pauseTo}
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button type="submit">{t.pauseSave}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {de.account.cancel}
            </Button>
          </div>
        </form>
      </Sheet>
      {pauses.length > 0 && error && !open && <p role="alert">{error}</p>}
    </section>
  );
}

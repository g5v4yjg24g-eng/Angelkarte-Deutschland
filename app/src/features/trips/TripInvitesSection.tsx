// Einladungen zu Angelterminen im Kalender (Wunsch Nutzer 2026-11-11): zusagen übernimmt den Termin in den eigenen
// Kalender, absagen blendet die Einladung aus. Zugesagte, die auf diesem Gerät fehlen (Zusage auf einem anderen
// Gerät), werden still übernommen – außer der Termin wurde hier gelöscht.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { getDb } from '../../data/db';
import { missingAccepted, openInvites, type TripInvite } from '../../domain/tripInvites';
import { importInvite } from './importInvite';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import styles from '../calendar/Calendar.module.css';

const t = de.calendar;

export function TripInvitesSection() {
  const { account } = useProviders();
  const online = useOnline();
  const signedIn = account.enabled && !!storedUserId();
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!signedIn || !online) return;
    let live = true;
    void (async () => {
      const list = await account.myTripInvites().catch(() => undefined);
      if (!list || !live) return;
      const known = new Set((await getDb().trips.toArray()).map((x) => x.id));
      for (const i of missingAccepted(list, known)) await importInvite(i).catch(() => undefined);
      if (live) setInvites(openInvites(list));
    })();
    return () => {
      live = false;
    };
  }, [account, signedIn, online, tick]);

  if (invites.length === 0 && !error) return null;

  const answer = async (i: TripInvite, accept: boolean) => {
    setBusy(i.tripId);
    setError(undefined);
    try {
      if (accept) await importInvite(i);
      await account.respondTripInvite(i.tripId, accept);
      setTick((n) => n + 1);
    } catch {
      setError(t.inviteAnswerError);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <section aria-labelledby="trip-invites" className={styles.invites}>
      <h2 id="trip-invites">{t.invitesTitle}</h2>
      {invites.map((i) => (
        <div key={i.tripId} className={styles.inviteCard}>
          <p className={styles.tripHead}>
            {[t.dayTitle(i.date), t.time(i.from, i.to)].filter(Boolean).join(' · ')}
          </p>
          <p className={styles.tripName}>{i.title ?? i.waterName ?? t.inviteFrom(i.hostDisplayName)}</p>
          {(i.title && i.waterName) || i.title || i.waterName ? (
            <p className="muted">
              {[i.title ? i.waterName : undefined, t.inviteFrom(i.hostDisplayName)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button disabled={busy === i.tripId} onClick={() => void answer(i, true)}>
              {t.accept}
            </Button>
            <Button variant="secondary" disabled={busy === i.tripId} onClick={() => void answer(i, false)}>
              {t.decline}
            </Button>
          </div>
        </div>
      ))}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}

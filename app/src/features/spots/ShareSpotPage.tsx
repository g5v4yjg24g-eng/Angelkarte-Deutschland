// Einen eigenen Ort teilen (Etappe 4): mit allen Freunden oder einem ausgewählten Freund, genaue Position
// (Entscheidung Nutzer 2026-11-03). Zeigt, mit wem der Ort schon geteilt ist, und beendet das Teilen.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { getDb } from '../../data/db';
import { groupFriends } from '../../domain/friends';
import { outgoingSpots, shareInput } from '../../domain/sharedSpots';
import { useProviders } from '../../ports/providersContext';
import { FounderBadge } from '../badges/FounderBadge';
import { useFriends } from '../friends/useFriends';
import { PlaceHead } from './SharedSpotDetails';
import { spotErrorText } from './spotErrors';
import { useSharedSpots } from './useSharedSpots';
import styles from './Spots.module.css';

const t = de.spots;
const ALL = 'all';

export function ShareSpotPage() {
  const { placeId = '' } = useParams();
  const { account } = useProviders();
  const place = useLiveQuery(() => getDb().places.get(placeId), [placeId]);
  const { state: friends } = useFriends();
  const { state: spots, reload } = useSharedSpots();
  const [target, setTarget] = useState(ALL);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  if (friends.kind === 'signedOut')
    return (
      <Page title={t.shareTitle} back="/">
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );
  if (place === undefined && placeId)
    return (
      <Page title={t.shareTitle} back="/">
        <p className="muted">{t.loading}</p>
      </Page>
    );
  if (!place || place.deletedAt)
    return (
      <Page title={t.shareTitle} back="/">
        <Notice>{t.placeMissing}</Notice>
      </Page>
    );

  const list = friends.kind === 'ready' ? groupFriends(friends.list).friends : [];
  const current = spots.kind === 'ready' ? outgoingSpots(spots.list, place.id) : [];
  const sharedAll = current.some((s) => !s.recipient);
  const sharedTo = new Set(current.flatMap((s) => (s.recipient ? [s.recipient.id] : [])));
  const again = target === ALL ? sharedAll : sharedTo.has(target);

  const run = async (fn: () => Promise<string | undefined>) => {
    setBusy(true);
    setError(undefined);
    setStatus(undefined);
    try {
      setStatus(await fn());
      await reload();
    } catch (e) {
      setError(spotErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const friend = list.find((f) => f.userId === target);
    void run(async () => {
      await account.shareSpot(shareInput(place, friend?.userId));
      return t.sharedWith(friend ? t.to(friend.displayName) : t.toAll);
    });
  };

  return (
    <Page title={t.shareTitle} back="/">
      <div className={styles.item}>
        <PlaceHead icon={`place-${place.type}`} title={place.name ?? de.map.placeTypes[place.type]}>
          {place.name && de.map.placeTypes[place.type]}
        </PlaceHead>
        <p className="muted tabular">{de.map.coords(place.position.lat, place.position.lng)}</p>
      </div>
      <Section title={t.whatTitle}>
        <p className="muted">{t.what}</p>
      </Section>

      {friends.kind === 'loading' && <p className="muted">{t.loading}</p>}
      {friends.kind === 'error' && <Notice tone="error">{spotErrorText(friends.error)}</Notice>}
      {friends.kind === 'ready' && list.length === 0 && (
        <>
          <Notice>{t.noFriends}</Notice>
          <Link to="/profil/freunde">{t.toFriends}</Link>
        </>
      )}
      {list.length > 0 && (
        <form onSubmit={submit}>
          <fieldset className={styles.choices}>
            <legend>{t.withTitle}</legend>
            <label className={styles.choice}>
              <input
                type="radio"
                name="target"
                value={ALL}
                checked={target === ALL}
                onChange={() => setTarget(ALL)}
              />
              <span>
                <strong>{t.allFriends}</strong>
                <span className="muted">{t.allFriendsHint}</span>
              </span>
            </label>
            {list.map((f) => (
              <label key={f.userId} className={styles.choice}>
                <input
                  type="radio"
                  name="target"
                  value={f.userId}
                  checked={target === f.userId}
                  onChange={() => setTarget(f.userId)}
                />
                <span>
                  <strong>
                    {f.displayName}
                    {f.badges.includes('founder') && <FounderBadge />}
                  </strong>
                  <span className="muted">{de.friends.handle(f.username)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className={styles.buttons}>
            <Button type="submit" disabled={busy}>
              {busy ? t.sharing : again ? t.shareAgain : t.share}
            </Button>
          </div>
        </form>
      )}
      <p role="status" className={styles.status}>
        {status}
      </p>
      {error && <Notice tone="error">{error}</Notice>}

      {current.length > 0 && (
        <Section title={t.currentTitle}>
          <ul className={styles.list}>
            {current.map((s) => (
              <li key={s.id} className={styles.item}>
                <p>{s.recipient ? t.to(s.recipient.name) : t.toAll}</p>
                <div className={styles.buttons}>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await account.unshareSpot(s.id);
                        return t.unshared;
                      })
                    }
                  >
                    {t.unshare}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <p>
        <Link to="/profil/spots">{t.open}</Link>
      </p>
    </Page>
  );
}

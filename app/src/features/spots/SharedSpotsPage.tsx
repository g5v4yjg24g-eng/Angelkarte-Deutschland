// Geteilte Spots (Etappe 4, Wunsch Nutzer 2026-11-03): mit mir geteilt (auf der Karte zeigen, übernehmen)
// und von mir geteilt (Teilen beenden). Nur angemeldet – sonst kein Netz.
import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { HeroBanner } from '../../design/components/HeroBanner';
import { Sheet } from '../../design/components/Sheet';
import { Button, IconButton } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Toast } from '../../design/components/Toast';
import { FeedIcon, MapIcon, PinIcon, RefreshIcon, SendIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { adoptSharedSpot } from '../../data/sharedSpotService';
import { userMessage } from '../../data/errors';
import { adoptedPlace, incomingSpots, outgoingSpots } from '../../domain/sharedSpots';
import { spotErrorText } from './spotErrors';
import { useProviders } from '../../ports/providersContext';
import type { MapFocusState } from '../map/MapView';
import { SharedSpotDetails, SpotHead } from './SharedSpotDetails';
import { useSharedSpots } from './useSharedSpots';
import { isHidden } from '../../domain/moderation';
import { useHidden } from '../moderation/hiddenStore';
import styles from './Spots.module.css';

const t = de.spots;
type Tab = 'incoming' | 'outgoing';

export function SharedSpotsPage() {
  const { account } = useProviders();
  const { state, reload } = useSharedSpots();
  const places = useLiveQuery(() => getDb().places.toArray(), []);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [tab, setTab] = useState<Tab>('incoming');
  const [picking, setPicking] = useState(false);
  const tabsId = useId();
  const hidden = useHidden();

  const refresh = <IconButton label={de.feed.refresh} icon={<RefreshIcon />} onClick={() => void reload()} />;

  if (state.kind === 'signedOut')
    return (
      <Page title={t.title} back="/profil">
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );

  const incoming =
    state.kind === 'ready'
      ? incomingSpots(state.list).filter((x) => !isHidden(hidden, 'spot', x.id, x.ownerId))
      : [];
  const outgoing = state.kind === 'ready' ? outgoingSpots(state.list) : [];

  const unshare = async (id: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await account.unshareSpot(id);
      await reload();
      setToast(t.unshared);
    } catch (e) {
      setError(spotErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const onKeys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: Tab = tab === 'incoming' ? 'outgoing' : 'incoming';
    setTab(next);
    document.getElementById(`${tabsId}-${next}`)?.focus();
  };

  const empty = (kind: Tab) => (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {kind === 'incoming' ? <FeedIcon size={40} /> : <PinIcon size={40} />}
      </span>
      <strong>{t.emptyTitle}</strong>
      <p>{kind === 'incoming' ? t.emptyIncoming : t.emptyOutgoing}</p>
      <Button onClick={() => setPicking(true)}>
        <SendIcon size={18} aria-hidden="true" /> {t.shareSpot}
      </Button>
    </div>
  );

  return (
    <Page title={t.title} back="/profil" action={refresh}>
      <HeroBanner icon={<PinIcon size={34} />} title={t.title} subtitle={t.heroSubtitle} />
      {state.kind === 'loading' && <p className="muted">{t.loading}</p>}
      {state.kind === 'error' && <Notice tone="error">{spotErrorText(state.error)}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {state.kind === 'ready' && (
        <>
          <div role="tablist" aria-label={t.tabsLabel} className={styles.tabs} onKeyDown={onKeys}>
            {(
              [
                ['incoming', t.tabIncoming, incoming.length, <FeedIcon key="i" size={18} />],
                ['outgoing', t.tabOutgoing, outgoing.length, <PinIcon key="o" size={18} />],
              ] as const
            ).map(([k, label, n, icon]) => (
              <button
                key={k}
                id={`${tabsId}-${k}`}
                type="button"
                role="tab"
                aria-selected={tab === k}
                aria-controls={`${tabsId}-panel`}
                tabIndex={tab === k ? 0 : -1}
                className={styles.tab}
                onClick={() => setTab(k)}
              >
                {icon}
                <span>
                  {label} ({n})
                </span>
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${tabsId}-panel`}
            aria-labelledby={`${tabsId}-${tab}`}
            className={styles.panel}
          >
            {tab === 'incoming' &&
              (incoming.length === 0 ? (
                empty('incoming')
              ) : (
                <ul className={styles.list}>
                  {incoming.map((s) => (
                    <li key={s.id} className={styles.item}>
                      <SharedSpotDetails
                        spot={s}
                        adopted={!!places && !!adoptedPlace(s, places)}
                        onSafety={setToast}
                        onShowMap={() =>
                          void navigate('/', { state: { focusShared: s.id } satisfies MapFocusState })
                        }
                        onAdopt={() =>
                          void adoptSharedSpot(s, t.adoptOrigin)
                            .then(() => setToast(t.adoptedToast))
                            .catch((e: unknown) => setError(userMessage(e)))
                        }
                      />
                    </li>
                  ))}
                </ul>
              ))}
            {tab === 'outgoing' &&
              (outgoing.length === 0 ? (
                empty('outgoing')
              ) : (
                <>
                  <ul className={styles.list}>
                    {outgoing.map((s) => (
                      <li key={s.id} className={styles.item}>
                        <SpotHead spot={s} />
                        <div className={styles.buttons}>
                          <Button variant="secondary" disabled={busy} onClick={() => void unshare(s.id)}>
                            {t.unshare}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Button variant="secondary" onClick={() => setPicking(true)}>
                    <SendIcon size={18} aria-hidden="true" /> {t.shareSpot}
                  </Button>
                </>
              ))}
          </div>
          <ul className={styles.perks}>
            <li>
              <MapIcon size={22} aria-hidden="true" />
              {t.perkDiscover}
            </li>
            <li>
              <FeedIcon size={22} aria-hidden="true" />
              {t.perkShare}
            </li>
            <li>
              <PinIcon size={22} aria-hidden="true" />
              {t.perkMap}
            </li>
          </ul>
        </>
      )}
      <Sheet open={picking} title={t.pickTitle} onClose={() => setPicking(false)}>
        {places && places.filter((p) => !p.deletedAt).length > 0 ? (
          <ul className={styles.list}>
            {places
              .filter((p) => !p.deletedAt)
              .map((p) => (
                <li key={p.id}>
                  <Link
                    className={styles.pick}
                    to={`/profil/spots/teilen/${encodeURIComponent(p.id)}`}
                    onClick={() => setPicking(false)}
                  >
                    <strong>{p.name ?? de.map.placeTypes[p.type]}</strong>
                    {p.name && <span className="muted">{de.map.placeTypes[p.type]}</span>}
                  </Link>
                </li>
              ))}
          </ul>
        ) : (
          <>
            <p className="muted">{t.noPlaces}</p>
            <Link to="/">{t.toMap}</Link>
          </>
        )}
      </Sheet>
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

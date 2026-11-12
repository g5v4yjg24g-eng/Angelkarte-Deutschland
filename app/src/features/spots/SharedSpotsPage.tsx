// Geteilte Spots (Wunsch Nutzer 2026-11-12): Verbindungen als Visitenkarten. Reiter „Mit dir geteilt“ und „Von dir
// geteilt“ zeigen je Person die Zahl der Spots; Angebote an mich lassen sich annehmen oder ablehnen, bestehende per
// X oder Wisch beenden (mit Rückfrage). Nur angemeldet – sonst kein Netz.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
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
import { adoptedPlace, incomingSpots } from '../../domain/sharedSpots';
import { sharedByMe, sharedWithMe, spotLinkErrorKind, type SpotLink } from '../../domain/spotLinks';
import type { FriendEntry } from '../../domain/friends';
import { useProviders } from '../../ports/providersContext';
import type { MapFocusState } from '../map/MapView';
import { useAvatarUrls } from '../profile/avatarUrls';
import { useMemberAchievements } from '../sessions/group/useMemberAchievements';
import { SharedSpotDetails } from './SharedSpotDetails';
import { SpotLinkCard } from './SpotLinkCard';
import { notifySpotsChanged } from './spotsChanged';
import { useSharedSpots } from './useSharedSpots';
import { useSpotLinks } from './useSpotLinks';
import { spotErrorText } from './spotErrors';
import { isHidden } from '../../domain/moderation';
import { useHidden } from '../moderation/hiddenStore';
import styles from './Spots.module.css';

const t = de.spots;
type Tab = 'incoming' | 'outgoing';

const linkErrorText = (e: unknown) => {
  const k = spotLinkErrorKind(e);
  const m = t.link;
  switch (k) {
    case 'not_friends':
      return m.notFriends;
    case 'declined_recently':
      return m.declinedRecently;
    case 'too_many':
      return m.tooMany;
    case 'not_found':
      return m.notFound;
    case 'no_profile':
      return m.noProfile;
    default:
      return e instanceof Error && /fetch|network/i.test(e.message) ? t.errors.offline : m.unknown;
  }
};

export function SharedSpotsPage() {
  const { account } = useProviders();
  const links = useSpotLinks();
  const spots = useSharedSpots();
  const places = useLiveQuery(() => getDb().places.toArray(), []);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [tab, setTab] = useState<Tab>('incoming');
  const [offering, setOffering] = useState(false);
  const [ending, setEnding] = useState<SpotLink>();
  const [expanded, setExpanded] = useState<string>();
  const tabsId = useId();
  const hidden = useHidden();
  const state = links.state;

  const list = state.kind === 'ready' ? state.list : [];
  const withMe = sharedWithMe(list);
  const byMe = sharedByMe(list);
  const shown = tab === 'incoming' ? withMe : byMe;
  const ids = list.map((l) => l.partnerId);
  const avatars = useAvatarUrls(ids);
  const achievements = useMemberAchievements(ids);

  const refresh = (
    <IconButton
      label={de.feed.refresh}
      icon={<RefreshIcon />}
      onClick={() => {
        void links.reload();
        void spots.reload();
      }}
    />
  );

  if (state.kind === 'signedOut')
    return (
      <Page title={t.title} back="/profil">
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      await links.reload();
      await spots.reload();
      notifySpotsChanged();
      if (done) setToast(done);
    } catch (e) {
      setError(linkErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const answer = (l: SpotLink, accept: boolean) =>
    run(() => account.respondSpotLink(l.id, accept), t.answered);
  const join = (l: SpotLink) => run(() => account.joinSpotLink(l.id), t.offerAccepted);
  const end = async () => {
    const l = ending;
    if (!l) return;
    setEnding(undefined);
    await run(() => account.endSpotLink(l.id), t.ended);
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
      <Button onClick={() => setOffering(true)}>
        <SendIcon size={18} aria-hidden="true" /> {t.shareSpot}
      </Button>
    </div>
  );

  const partnerSpots = (l: SpotLink) => {
    if (tab !== 'incoming' || l.status !== 'accepted' || l.spotsFromPartner === 0) return null;
    const mine =
      spots.state.kind === 'ready'
        ? incomingSpots(spots.state.list).filter(
            (x) => x.ownerId === l.partnerId && !isHidden(hidden, 'spot', x.id, x.ownerId),
          )
        : [];
    const open = expanded === l.id;
    return (
      <>
        <button
          type="button"
          className={styles.spotsToggle}
          aria-expanded={open}
          onClick={() => setExpanded(open ? undefined : l.id)}
        >
          {open ? t.hideSpots : t.showSpots(l.spotsFromPartner)}
        </button>
        {open && (
          <ul className={styles.list}>
            {mine.map((s) => (
              <li key={s.id} className={styles.item}>
                <SharedSpotDetails
                  spot={s}
                  adopted={!!places && !!adoptedPlace(s, places)}
                  onSafety={setToast}
                  onShowMap={() => void navigate('/', { state: { focusShared: s.id } satisfies MapFocusState })}
                  onAdopt={() =>
                    void adoptSharedSpot(s, t.adoptOrigin)
                      .then(() => setToast(t.adoptedToast))
                      .catch((e: unknown) => setError(userMessage(e)))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

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
                ['incoming', t.tabIncoming, withMe.length, <FeedIcon key="i" size={18} />],
                ['outgoing', t.tabOutgoing, byMe.length, <PinIcon key="o" size={18} />],
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
            {shown.length === 0 ? (
              empty(tab)
            ) : (
              <>
                {shown.map((l) => (
                  <SpotLinkCard
                    key={l.id}
                    link={l}
                    tab={tab}
                    avatarUrl={avatars.get(l.partnerId)}
                    unlocked={achievements.get(l.partnerId)}
                    busy={busy}
                    onAnswer={(a) => void answer(l, a)}
                    onEnd={() => setEnding(l)}
                    onJoin={() => void join(l)}
                  >
                    {partnerSpots(l)}
                  </SpotLinkCard>
                ))}
                <Button variant="secondary" onClick={() => setOffering(true)}>
                  <SendIcon size={18} aria-hidden="true" /> {t.shareSpot}
                </Button>
              </>
            )}
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
      <OfferSheet
        open={offering}
        links={list}
        onClose={() => setOffering(false)}
        onOffer={(f) =>
          void run(async () => {
            const r = await account.offerSpotLink(f.userId);
            setOffering(false);
            setToast(
              r === 'accepted'
                ? t.offerAccepted
                : r === 'offered'
                  ? t.offerSent
                  : r === 'pending'
                    ? t.offerPending
                    : t.offerAlready,
            );
          })
        }
        busy={busy}
      />
      <Sheet open={!!ending} title={t.endTitle} onClose={() => setEnding(undefined)}>
        {ending && (
          <div className={styles.confirmBox}>
            <p>{t.endText(ending.displayName)}</p>
            <div className={styles.confirmActions}>
              <Button variant="secondary" onClick={() => setEnding(undefined)}>
                {t.endKeep}
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void end()}>
                {t.endConfirm}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      {toast && <Toast onDismiss={() => setToast(undefined)}>{toast}</Toast>}
    </Page>
  );
}

/** Freunde ohne Verbindung, denen man das Teilen anbieten kann */
function OfferSheet({
  open,
  links,
  busy,
  onClose,
  onOffer,
}: {
  open: boolean;
  links: readonly SpotLink[];
  busy: boolean;
  onClose: () => void;
  onOffer: (f: FriendEntry) => void;
}) {
  const { account } = useProviders();
  const [friends, setFriends] = useState<FriendEntry[]>();
  useEffect(() => {
    if (!open) return;
    let live = true;
    account
      .friends()
      .then((f) => live && setFriends(f))
      .catch(() => live && setFriends([]));
    return () => {
      live = false;
    };
  }, [open, account]);
  const linked = new Set(links.map((l) => l.partnerId));
  const free = (friends ?? []).filter((f) => f.status === 'accepted' && !linked.has(f.userId));
  return (
    <Sheet open={open} title={t.offerTitle} onClose={onClose}>
      {!friends ? (
        <p className="muted">{t.offerFriendsLoading}</p>
      ) : free.length === 0 ? (
        <p className="muted">{t.offerNoFriends}</p>
      ) : (
        <ul className={styles.list}>
          {free.map((f) => (
            <li key={f.userId} className={`${styles.item} ${styles.offerRow}`}>
              <span className={styles.who}>
                <strong>{f.displayName}</strong>
                <span className="muted">@{f.username}</span>
              </span>
              <Button disabled={busy} onClick={() => onOffer(f)}>
                {t.offer}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

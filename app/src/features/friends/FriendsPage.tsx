// Follower (Paket C, Wunsch Nutzer 2026-11-10: Folgen statt Freundschaft), Ansicht nach Vorlage (2026-11-11):
// Umschalter Follower | Gefolgt, Suchfeld, Zeilen mit „Entfernen“ und „…“. Anfragen stehen oben im Reiter Follower,
// „Angefragt“ unten bei Gefolgt; „Privates Konto“ und Blockierte ganz unten. Adresse bleibt /profil/freunde,
// der Reiter steht im #-Teil (#follower, #gefolgt – so führen die Zahlen im Profil hierher).
// Alles läuft über Server-Funktionen (supabase/migrations/*_follows.sql); die App schreibt nie direkt.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { Sheet } from '../../design/components/Sheet';
import { CheckIcon, SearchIcon } from '../../design/icons';
import type { Profile } from '../../domain/account';
import { followErrorKind, groupFollows, matchesQuery, type FollowEntry } from '../../domain/follows';
import { SEARCH_MIN } from '../../domain/userProfile';
import { followMessage } from './followMessage';
import { AccountError } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import { FounderBadge } from '../badges/FounderBadge';
import { useFollows } from './useFollows';
import { PrivateAccountSwitch } from './PrivateAccountSwitch';
import { UserSearchResults } from './UserSearchResults';
import { hiddenKey, type BlockedUser } from '../../domain/moderation';
import { SafetyMenu } from '../moderation/SafetyMenu';
import { unhideContent, useHidden } from '../moderation/hiddenStore';
import { Avatar } from '../profile/Avatar';
import { useAvatarUrl } from '../profile/avatarUrls';
import styles from './Friends.module.css';

const t = de.friends;

const errorText = (e: unknown) =>
  t.errors[followErrorKind(e instanceof AccountError || e instanceof Error ? e : undefined)];

type Tab = 'follower' | 'gefolgt';

function Person({
  f,
  mutual,
  children,
  onSafety,
  extra,
  wrap,
}: {
  f: FollowEntry;
  mutual?: boolean;
  /** zwei Knöpfe (Anfragen): dürfen unter den Namen rutschen */
  wrap?: boolean;
  children?: ReactNode;
  onSafety?: (message: string) => void;
  extra?: readonly { label: string; onSelect: () => void }[];
}) {
  const avatarUrl = useAvatarUrl(f.userId);
  return (
    <li className={wrap ? `${styles.person} ${styles.personWrap}` : styles.person}>
      <Avatar url={avatarUrl} size={48} />
      <span className={styles.who}>
        <strong>
          <Link to={`/profil/nutzer/${f.username}`} className={styles.nameLink}>
            {f.displayName}
          </Link>
          {f.badges.includes('founder') && <FounderBadge />}
        </strong>
        <span className="muted">
          {t.handle(f.username)}
          {mutual && ` · ${t.mutual}`}
        </span>
      </span>
      <span className={styles.buttons}>
        {children}
        {onSafety && (
          <SafetyMenu
            kind="user"
            targetId={f.userId}
            owner={{ id: f.userId, name: f.displayName }}
            onDone={onSafety}
            {...(extra ? { extra } : {})}
          />
        )}
      </span>
    </li>
  );
}

export function FriendsPage() {
  const { account } = useProviders();
  const { state, reload } = useFollows();
  const [me, setMe] = useState<Profile | null>();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<{ kind: 'unfollow' | 'remove'; f: FollowEntry }>();
  const [blocked, setBlocked] = useState<BlockedUser[]>();
  const [blockTick, setBlockTick] = useState(0);
  const hidden = useHidden();
  const { hash } = useLocation();
  const tab: Tab = hash === '#gefolgt' ? 'gefolgt' : 'follower';

  useEffect(() => {
    if (state.kind === 'signedOut') return;
    let live = true;
    account
      .blockedUsers()
      .then((list) => live && setBlocked(list))
      .catch(() => live && setBlocked(undefined));
    return () => {
      live = false;
    };
  }, [account, state.kind, blockTick]);

  // nach Melden/Blockieren: Listen neu laden und Hinweis zeigen
  const safetyDone = (message: string) => {
    setError(undefined);
    setStatus(message);
    reload();
    setBlockTick((n) => n + 1);
  };

  useEffect(() => {
    if (state.kind === 'signedOut') return;
    let live = true;
    account
      .getProfile()
      .then((p) => live && setMe(p))
      .catch(() => live && setMe(null));
    return () => {
      live = false;
    };
  }, [account, state.kind]);

  const run = async (fn: () => Promise<string | undefined>) => {
    setBusy(true);
    setError(undefined);
    setStatus(undefined);
    try {
      setStatus(await fn());
      reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setConfirm(undefined);
    }
  };

  if (state.kind === 'signedOut')
    return (
      <Page title={t.title} back="/profil">
        <Notice>{t.signedOut}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );
  if (me === null)
    return (
      <Page title={t.title} back="/profil">
        <Notice>{t.noProfile}</Notice>
        <Link to="/mehr/konto">{t.toAccount}</Link>
      </Page>
    );

  const groups =
    state.kind === 'ready'
      ? groupFollows(
          state.list.filter((f) => !hidden.has(hiddenKey('user', f.userId)) || f.status === 'accepted'),
        )
      : undefined;
  const followingIds = new Set(groups?.following.map((f) => f.userId));
  const requestedIds = new Set(groups?.requested.map((f) => f.userId));
  const find = (list: readonly FollowEntry[]) => list.filter((f) => matchesQuery(f, query));
  const requests = find(groups?.requests ?? []);
  const followers = find(groups?.followers ?? []);
  const following = find(groups?.following ?? []);
  const requested = find(groups?.requested ?? []);
  const shown = tab === 'follower' ? [...requests, ...followers] : [...following, ...requested];

  const tabLink = (id: Tab, label: string) => (
    <Link
      to={id === 'follower' ? '#follower' : '#gefolgt'}
      replace
      className={styles.tab}
      {...(tab === id ? { 'aria-current': 'page' as const } : {})}
    >
      {label}
    </Link>
  );

  return (
    <Page title={t.title} back="/profil">
      <nav className={styles.tabs} aria-label={t.tabsLabel}>
        {tabLink('follower', t.followersTitle(groups?.followers.length ?? 0))}
        {tabLink('gefolgt', t.followingTitle(groups?.following.length ?? 0))}
      </nav>
      <label className={styles.searchBox}>
        <SearchIcon size={20} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p role="status" className={styles.status}>
        {status}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {state.kind === 'loading' && <p className="muted">{t.loading}</p>}
      {state.kind === 'error' && <Notice tone="error">{errorText(state.error)}</Notice>}

      {groups && tab === 'follower' && (
        <>
          {requests.length > 0 && (
            <section aria-label={t.requestsTitle(requests.length)} className={styles.block}>
              <h2 className={styles.blockTitle}>{t.requestsTitle(requests.length)}</h2>
              <ul className={styles.list}>
                {requests.map((f) => (
                  <Person key={f.userId} f={f} onSafety={safetyDone} wrap>
                    <Button
                      className={styles.rowButton ?? ''}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await account.respondFollowRequest(f.userId, true);
                          return t.acceptedMsg(f.username);
                        })
                      }
                    >
                      {t.accept}
                    </Button>
                    <Button
                      className={styles.rowButton ?? ''}
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await account.respondFollowRequest(f.userId, false);
                          return undefined;
                        })
                      }
                    >
                      {t.decline}
                    </Button>
                  </Person>
                ))}
              </ul>
            </section>
          )}
          {groups.followers.length === 0 && requests.length === 0 && !query.trim() ? (
            <p className="muted">{t.noFollowers}</p>
          ) : (
            <ul className={styles.list} aria-label={t.followersTitle(followers.length)}>
              {followers.map((f) => {
                const back = followingIds.has(f.userId);
                const askedBack = requestedIds.has(f.userId);
                const remove = () => setConfirm({ kind: 'remove', f });
                return (
                  <Person
                    key={f.userId}
                    f={f}
                    mutual={groups.mutual.has(f.userId)}
                    onSafety={safetyDone}
                    {...(back ? {} : { extra: [{ label: t.removeFollowerMenu, onSelect: remove }] })}
                  >
                    {back ? (
                      <Button
                        className={styles.rowButton ?? ''}
                        variant="secondary"
                        disabled={busy}
                        onClick={remove}
                      >
                        {t.removeFollower}
                      </Button>
                    ) : (
                      !askedBack && (
                        <Button
                          className={styles.rowButton ?? ''}
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => followMessage(await account.follow(f.username), f.username))
                          }
                        >
                          {t.followBack}
                        </Button>
                      )
                    )}
                  </Person>
                );
              })}
            </ul>
          )}
        </>
      )}

      {groups && tab === 'gefolgt' && (
        <>
          {groups.following.length === 0 && requested.length === 0 && !query.trim() ? (
            <p className="muted">{t.noFollowing}</p>
          ) : (
            <ul className={styles.list} aria-label={t.followingTitle(following.length)}>
              {following.map((f) => (
                <Person key={f.userId} f={f} mutual={groups.mutual.has(f.userId)} onSafety={safetyDone}>
                  <Button
                    className={styles.rowButton ?? ''}
                    variant="secondary"
                    disabled={busy}
                    aria-label={t.unfollowAria(f.displayName)}
                    onClick={() => setConfirm({ kind: 'unfollow', f })}
                  >
                    {t.following2}
                    <CheckIcon size={16} />
                  </Button>
                </Person>
              ))}
            </ul>
          )}
          {requested.length > 0 && (
            <section aria-label={t.requestedTitle} className={styles.block}>
              <h2 className={styles.blockTitle}>{t.requestedTitle}</h2>
              <ul className={styles.list}>
                {requested.map((f) => (
                  <Person key={f.userId} f={f}>
                    <Button
                      className={styles.rowButton ?? ''}
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await account.unfollow(f.userId);
                          return undefined;
                        })
                      }
                    >
                      {t.withdraw}
                    </Button>
                  </Person>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {/* ab 3 Zeichen meldet die Suche darunter selbst „Niemand gefunden“ */}
      {groups && query.trim() && shown.length === 0 && query.trim().replace(/^@/, '').length < SEARCH_MIN && (
        <p className="muted">{t.noMatches}</p>
      )}

      <UserSearchResults
        query={query}
        busy={busy}
        reloadKey={state.kind === 'ready' ? state.list.length : 0}
        exclude={new Set(shown.map((f) => f.userId))}
        localCount={shown.length}
        onRequest={(u) =>
          void run(async () => {
            const r = await account.follow(u);
            return followMessage(r, u);
          })
        }
      />

      {groups && <PrivateAccountSwitch onChange={reload} />}
      {blocked && blocked.length > 0 && (
        <Section title={de.moderation.blockedTitle}>
          <ul className={styles.list}>
            {blocked.map((b) => (
              <li key={b.userId} className={styles.person}>
                <span className={styles.who}>
                  <strong>{b.displayName}</strong>
                  <span className="muted">{t.handle(b.username)}</span>
                </span>
                <span className={styles.buttons}>
                  <Button
                    className={styles.rowButton ?? ''}
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await account.unblockUser(b.userId);
                        unhideContent('user', b.userId);
                        setBlockTick((n) => n + 1);
                        return de.moderation.unblocked(b.displayName);
                      })
                    }
                  >
                    {de.moderation.unblock}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Sheet
        open={!!confirm}
        title={confirm?.kind === 'remove' ? t.removeFollowerTitle : t.unfollowTitle}
        onClose={() => setConfirm(undefined)}
      >
        {confirm && (
          <div className={styles.confirmBox}>
            <p>
              {confirm.kind === 'remove'
                ? t.confirmRemoveFollower(confirm.f.displayName)
                : t.confirmUnfollow(confirm.f.displayName)}
            </p>
            <div className={styles.confirmActions}>
              <Button variant="secondary" onClick={() => setConfirm(undefined)}>
                {t.cancel}
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (confirm.kind === 'remove') await account.removeFollower(confirm.f.userId);
                    else await account.unfollow(confirm.f.userId);
                    return undefined;
                  })
                }
              >
                {confirm.kind === 'remove' ? t.yesRemove : t.yesUnfollow}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  );
}

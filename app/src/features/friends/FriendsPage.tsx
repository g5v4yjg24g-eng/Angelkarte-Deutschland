// Follower (Paket C, Wunsch Nutzer 2026-11-10: Folgen statt Freundschaft): Leute finden und folgen, Anfragen
// bestätigen, Follower entfernen, nicht mehr folgen, „Privates Konto“ und Blockierte. Adresse bleibt /profil/freunde.
// Alles läuft über Server-Funktionen (supabase/migrations/*_follows.sql); die App schreibt nie direkt.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { TextField } from '../../design/components/Field';
import { Notice } from '../../design/components/Notice';
import { normalizeUsername, type Profile } from '../../domain/account';
import { followErrorKind, groupFollows, type FollowEntry } from '../../domain/follows';
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

function Person({
  f,
  mutual,
  children,
  onSafety,
}: {
  f: FollowEntry;
  mutual?: boolean;
  children?: React.ReactNode;
  onSafety?: (message: string) => void;
}) {
  const avatarUrl = useAvatarUrl(f.userId);
  return (
    <li className={styles.person}>
      <Avatar url={avatarUrl} size={40} />
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
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<{ id: string; kind: 'unfollow' | 'remove' }>();
  const [blocked, setBlocked] = useState<BlockedUser[]>();
  const [blockTick, setBlockTick] = useState(0);
  const hidden = useHidden();
  const { hash } = useLocation();
  // aus dem Profil: zu Follower bzw. Gefolgt springen, sobald die Liste da ist
  const ready = state.kind === 'ready';
  useEffect(() => {
    if (!ready || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [ready, hash]);

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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const u = normalizeUsername(name.replace(/^@/, ''));
    if (!u) return setError(t.errors.empty);
    void run(async () => {
      const r = await account.follow(u);
      setName('');
      return followMessage(r, u);
    });
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

  return (
    <Page title={t.title} back="/profil">
      {me && <p className="muted">{t.yourName(me.username)}</p>}
      <Section title={t.addTitle}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            label={t.usernameLabel}
            hint={t.usernameHint}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? t.sending : t.send}
            </Button>
          </div>
        </form>
        <p role="status" className={styles.status}>
          {status}
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <UserSearchResults
          query={name}
          busy={busy}
          reloadKey={state.kind === 'ready' ? state.list.length : 0}
          onRequest={(u) =>
            void run(async () => {
              const r = await account.follow(u);
              return followMessage(r, u);
            })
          }
        />
      </Section>
      <PrivateAccountSwitch onChange={reload} />

      {state.kind === 'loading' && <p className="muted">{t.loading}</p>}
      {state.kind === 'error' && <Notice tone="error">{errorText(state.error)}</Notice>}
      {groups && (
        <>
          {groups.requests.length > 0 && (
            <Section title={t.requestsTitle(groups.requests.length)}>
              <ul className={styles.list}>
                {groups.requests.map((f) => (
                  <Person key={f.userId} f={f} onSafety={safetyDone}>
                    <Button
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
            </Section>
          )}
          <Section title={t.followersTitle(groups.followers.length)}>
            <span id="follower" />
            {groups.followers.length === 0 ? (
              <p className="muted">{t.noFollowers}</p>
            ) : (
              <ul className={styles.list} aria-label={t.followersTitle(groups.followers.length)}>
                {groups.followers.map((f) => (
                  <Person key={f.userId} f={f} mutual={groups.mutual.has(f.userId)} onSafety={safetyDone}>
                    {confirm?.id === f.userId && confirm.kind === 'remove' ? (
                      <>
                        <span className={styles.confirm}>{t.confirmRemoveFollower(f.displayName)}</span>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await account.removeFollower(f.userId);
                              return undefined;
                            })
                          }
                        >
                          {t.yesRemove}
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirm(undefined)}>
                          {t.cancel}
                        </Button>
                      </>
                    ) : (
                      <>
                        {!followingIds.has(f.userId) && !requestedIds.has(f.userId) && (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void run(async () =>
                                followMessage(await account.follow(f.username), f.username),
                              )
                            }
                          >
                            {t.followBack}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirm({ id: f.userId, kind: 'remove' })}
                        >
                          {t.removeFollower}
                        </Button>
                      </>
                    )}
                  </Person>
                ))}
              </ul>
            )}
          </Section>
          <Section title={t.followingTitle(groups.following.length)}>
            <span id="gefolgt" />
            {groups.following.length === 0 ? (
              <p className="muted">{t.noFollowing}</p>
            ) : (
              <ul className={styles.list} aria-label={t.followingTitle(groups.following.length)}>
                {groups.following.map((f) => (
                  <Person key={f.userId} f={f} mutual={groups.mutual.has(f.userId)} onSafety={safetyDone}>
                    {confirm?.id === f.userId && confirm.kind === 'unfollow' ? (
                      <>
                        <span className={styles.confirm}>{t.confirmUnfollow(f.displayName)}</span>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await account.unfollow(f.userId);
                              return undefined;
                            })
                          }
                        >
                          {t.yesUnfollow}
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirm(undefined)}>
                          {t.cancel}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirm({ id: f.userId, kind: 'unfollow' })}
                      >
                        {t.unfollow}
                      </Button>
                    )}
                  </Person>
                ))}
              </ul>
            )}
          </Section>
          {groups.requested.length > 0 && (
            <Section title={t.requestedTitle}>
              <ul className={styles.list}>
                {groups.requested.map((f) => (
                  <Person key={f.userId} f={f}>
                    <Button
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
            </Section>
          )}
          <p className="muted">{t.friendsHint}</p>
        </>
      )}
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
    </Page>
  );
}

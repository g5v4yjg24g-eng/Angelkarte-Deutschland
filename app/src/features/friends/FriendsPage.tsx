// Freunde (Etappe 1, Wunsch Nutzer 2026-11-03): Anfrage per Nutzername, annehmen/ablehnen, zurückziehen, entfernen.
// Alles läuft über Server-Funktionen (supabase/migrations/*_friendships.sql); die App schreibt nie direkt.
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { TextField } from '../../design/components/Field';
import { Notice } from '../../design/components/Notice';
import { normalizeUsername, type Profile } from '../../domain/account';
import { friendErrorKind, groupFriends, type FriendEntry } from '../../domain/friends';
import { AccountError } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import { FounderBadge } from '../badges/FounderBadge';
import { useFriends } from './useFriends';
import styles from './Friends.module.css';

const t = de.friends;

const errorText = (e: unknown) =>
  t.errors[friendErrorKind(e instanceof AccountError || e instanceof Error ? e : undefined)];

function Person({ f, children }: { f: FriendEntry; children?: React.ReactNode }) {
  return (
    <li className={styles.person}>
      <span className={styles.who}>
        <strong>
          {f.displayName}
          {f.badges.includes('founder') && <FounderBadge />}
        </strong>
        <span className="muted">{t.handle(f.username)}</span>
      </span>
      {children && <span className={styles.buttons}>{children}</span>}
    </li>
  );
}

export function FriendsPage() {
  const { account } = useProviders();
  const { state, reload } = useFriends();
  const [me, setMe] = useState<Profile | null>();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<string>();

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
      const r = await account.sendFriendRequest(u);
      setName('');
      return r === 'sent' ? t.sent(u) : r === 'accepted' ? t.nowFriends(u) : t.already(u);
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

  const groups = state.kind === 'ready' ? groupFriends(state.list) : undefined;

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
      </Section>

      {state.kind === 'loading' && <p className="muted">{t.loading}</p>}
      {state.kind === 'error' && <Notice tone="error">{errorText(state.error)}</Notice>}
      {groups && (
        <>
          {groups.incoming.length > 0 && (
            <Section title={t.incomingTitle}>
              <ul className={styles.list}>
                {groups.incoming.map((f) => (
                  <Person key={f.requestId} f={f}>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await account.respondFriendRequest(f.requestId, true);
                          return t.nowFriends(f.username);
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
                          await account.respondFriendRequest(f.requestId, false);
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
          {groups.outgoing.length > 0 && (
            <Section title={t.outgoingTitle}>
              <ul className={styles.list}>
                {groups.outgoing.map((f) => (
                  <Person key={f.requestId} f={f}>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await account.removeFriend(f.userId);
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
          <Section title={t.friendsTitle(groups.friends.length)}>
            {groups.friends.length === 0 ? (
              <p className="muted">{t.noFriends}</p>
            ) : (
              <ul className={styles.list}>
                {groups.friends.map((f) => (
                  <Person key={f.requestId} f={f}>
                    {confirm === f.userId ? (
                      <>
                        <span className={styles.confirm}>{t.confirmRemove(f.displayName)}</span>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await account.removeFriend(f.userId);
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
                      <Button variant="ghost" disabled={busy} onClick={() => setConfirm(f.userId)}>
                        {t.remove}
                      </Button>
                    )}
                  </Person>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </Page>
  );
}

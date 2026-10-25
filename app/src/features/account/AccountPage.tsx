// Mehr → Konto (Etappe 1, Entscheidung Nutzer 2026-10-25): freiwillig, Anmeldung per E-Mail-Code, Profil mit
// Nutzername, Anzeigename ändern, abmelden, Konto löschen. Fangdaten bleiben auf dem Gerät.
import { useEffect, useState, type FormEvent } from 'react';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextField } from '../../design/components/Field';
import { useProviders } from '../../ports/providersContext';
import type { AccountProvider, AccountUser } from '../../ports/account';
import {
  accountErrorKind,
  displayNameValid,
  normalizeCode,
  normalizeDisplayName,
  normalizeEmail,
  normalizeUsername,
  resendIn,
  usernameIssue,
  validCode,
  validEmail,
  type AccountErrorKind,
  type Profile,
} from '../../domain/account';
import { useNow } from '../../lib/useNow';
import pageStyles from '../../design/components/Page.module.css';
import styles from './Account.module.css';

const t = de.account;
const errorText = (e: unknown) =>
  t.errors[accountErrorKind(e as { message?: string; status?: number; code?: string })];

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function SignIn({ account }: { account: AccountProvider }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [sentAt, setSentAt] = useState<number>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const now = useNow(1000);
  const wait = resendIn(sentAt, now);

  const send = async (to: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await account.requestCode(to);
      setSentTo(to);
      setSentAt(Date.now());
      setCode('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) return setFieldError(t.emailInvalid);
    setFieldError(undefined);
    void send(normalizeEmail(email));
  };
  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    if (!validCode(code)) return setFieldError(t.codeInvalid);
    setFieldError(undefined);
    setBusy(true);
    setError(undefined);
    try {
      await account.verifyCode(sentTo, normalizeCode(code));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (!sentTo)
    return (
      <form className={styles.form} onSubmit={submitEmail} noValidate>
        <TextField
          label={t.emailLabel}
          hint={t.emailHint}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={fieldError}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? t.working : t.sendCode}
          </Button>
        </div>
      </form>
    );

  return (
    <form className={styles.form} onSubmit={(e) => void submitCode(e)} noValidate>
      <Notice>{t.codeSent(sentTo)}</Notice>
      <TextField
        label={t.codeLabel}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={12}
        value={code}
        error={fieldError}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy}>
          {busy ? t.working : t.verify}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || wait > 0}
          onClick={() => void send(sentTo)}
        >
          {wait > 0 ? t.resendIn(wait) : t.resend}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSentTo(undefined);
            setError(undefined);
            setFieldError(undefined);
          }}
        >
          {t.otherEmail}
        </Button>
      </div>
    </form>
  );
}

function CreateProfile({
  account,
  onCreated,
}: {
  account: AccountProvider;
  onCreated: (p: Profile) => void;
}) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [free, setFree] = useState<'checking' | 'free' | 'taken'>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const issue = username ? usernameIssue(username) : undefined;
  const clean = normalizeUsername(username);

  // Verfügbarkeit prüfen, sobald der Name gültig ist (kurz verzögert)
  useEffect(() => {
    if (!clean || usernameIssue(clean)) return;
    let live = true;
    const id = window.setTimeout(() => {
      setFree('checking');
      account
        .usernameAvailable(clean)
        .then((ok) => live && setFree(ok ? 'free' : 'taken'))
        .catch(() => live && setFree(undefined));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [account, clean]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (usernameIssue(clean)) return;
    if (!displayNameValid(displayName)) return setNameError(t.displayNameInvalid);
    setNameError(undefined);
    setBusy(true);
    setError(undefined);
    try {
      onCreated(await account.createProfile(clean, normalizeDisplayName(displayName)));
    } catch (err) {
      const kind: AccountErrorKind = accountErrorKind(err as { message?: string; code?: string });
      if (kind === 'usernameTaken') setFree('taken');
      setError(t.errors[kind]);
    } finally {
      setBusy(false);
    }
  };

  const usernameError = issue
    ? t.usernameIssues[issue]
    : free === 'taken'
      ? t.errors.usernameTaken
      : undefined;
  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <h2 className={styles.h2}>{t.createTitle}</h2>
      <p className="muted">{t.createIntro}</p>
      <TextField
        label={t.usernameLabel}
        hint={t.usernameHint}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={20}
        value={username}
        error={usernameError}
        onChange={(e) => {
          setUsername(e.target.value);
          setFree(undefined);
        }}
      />
      {!usernameError && free && free !== 'taken' && (
        <p className="muted" role="status">
          {free === 'checking' ? t.usernameChecking : t.usernameFree}
        </p>
      )}
      <TextField
        label={t.displayNameLabel}
        hint={t.displayNameHint}
        maxLength={40}
        value={displayName}
        error={nameError}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <Button type="submit" disabled={busy || !!issue || free === 'taken' || !clean}>
          {busy ? t.working : t.create}
        </Button>
      </div>
    </form>
  );
}

function ProfileView({
  account,
  user,
  profile,
  onProfile,
  onDeleted,
}: {
  account: AccountProvider;
  user: AccountUser;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    setStatus(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <div className={pageStyles.card}>
        <div className={styles.profile}>
          <strong className={styles.displayName}>{profile.displayName}</strong>
          <span className="muted">{t.usernameShown(profile.username)}</span>
          <span className={`muted ${styles.small}`}>{t.signedInAs(user.email)}</span>
        </div>
      </div>
      {editing ? (
        <form
          className={styles.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!displayNameValid(name)) return setError(t.displayNameInvalid);
            void run(async () => {
              onProfile(await account.updateDisplayName(normalizeDisplayName(name)));
              setEditing(false);
              setStatus(t.saved);
            });
          }}
        >
          <TextField
            label={t.displayNameLabel}
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className={styles.actions}>
            <Button type="submit" disabled={busy}>
              {t.save}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => {
              setName(profile.displayName);
              setEditing(true);
            }}
          >
            {t.editDisplayName}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void run(() => account.signOut())}>
            {t.signOut}
          </Button>
        </div>
      )}
      {status && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Notice>{t.friendsSoon}</Notice>

      <section className={styles.danger} aria-labelledby="acc-delete">
        <h2 id="acc-delete" className={styles.h2}>
          {t.deleteTitle}
        </h2>
        <p className="muted">{t.deleteText}</p>
        <TextField
          label={t.deleteConfirmLabel(profile.username)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <div>
          <Button
            variant="danger"
            disabled={busy || normalizeUsername(confirm) !== profile.username}
            onClick={() =>
              void run(async () => {
                onDeleted();
                await account.deleteAccount();
              })
            }
          >
            {t.deleteButton}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function AccountPage() {
  const { account } = useProviders();
  const online = useOnline();
  const [user, setUserState] = useState<AccountUser | null>();
  // Profil gehört zu einer Nutzer-ID; bei Wechsel/Abmeldung gilt es nicht mehr
  const [loaded, setLoaded] = useState<{ uid: string; profile?: Profile | null; error?: string }>();
  const [wasSignedIn, setWasSignedIn] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (!account.enabled) return;
    let live = true;
    const setUser = (u: AccountUser | null) => {
      if (!live) return;
      setUserState(u);
      if (u) setWasSignedIn(true);
    };
    account
      .currentUser()
      .then(setUser)
      .catch(() => setUser(null));
    const off = account.onChange(setUser);
    return () => {
      live = false;
      off();
    };
  }, [account]);

  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    let live = true;
    account
      .getProfile()
      .then((p) => live && setLoaded({ uid, profile: p }))
      .catch((e) => live && setLoaded({ uid, error: errorText(e) }));
    return () => {
      live = false;
    };
  }, [account, uid]);

  const current = loaded && loaded.uid === uid ? loaded : undefined;
  const profile = current?.profile;
  const error = current?.error;
  const setProfile = (p: Profile) => uid && setLoaded({ uid, profile: p });

  return (
    <Page title={t.title} back="/mehr">
      <p className="muted">{t.intro}</p>
      {!account.enabled ? (
        <Notice>{t.disabled}</Notice>
      ) : (
        <div className={styles.stack}>
          {!online && <Notice tone="warning">{t.offline}</Notice>}
          {user === undefined ? (
            <p className="muted">{t.loading}</p>
          ) : user === null ? (
            <>
              {wasSignedIn && (
                <p className="muted" role="status">
                  {deleted ? t.deleted : t.signedOut}
                </p>
              )}
              <SignIn account={account} />
            </>
          ) : error ? (
            <Notice tone="error">{error}</Notice>
          ) : profile === undefined ? (
            <p className="muted">{t.loading}</p>
          ) : profile === null ? (
            <CreateProfile account={account} onCreated={setProfile} />
          ) : (
            <ProfileView
              account={account}
              user={user}
              profile={profile}
              onProfile={setProfile}
              onDeleted={() => setDeleted(true)}
            />
          )}
        </div>
      )}
    </Page>
  );
}

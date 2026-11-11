// Mehr → Konto (Etappe 1, Entscheidung Nutzer 2026-10-25): freiwillig, Profil mit Nutzername, Anzeigename ändern,
// abmelden, Konto löschen. Fangdaten bleiben auf dem Gerät. Seit 2026-11-10 Anmeldung mit E-Mail und Passwort
// (AuthForms.tsx) und Abschnitt „Sicherheit“ (SecuritySection.tsx).
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextField } from '../../design/components/Field';
import { ListLink } from '../../design/components/ListLink';
import { ExitIcon, FeedIcon, MailIcon, PencilIcon, TrashIcon } from '../../design/icons';
import { useProviders } from '../../ports/providersContext';
import { FounderBadge } from '../badges/FounderBadge';
import { clearBadges, refreshBadges, useMyBadges } from '../badges/badgeStore';
import { clearSharedSpots } from '../spots/useSharedSpots';
import { unregisterDevice } from '../push/pushDevice';
import type { AccountProvider, AccountUser } from '../../ports/account';
import {
  accountErrorKind,
  authLinkInHash,
  displayNameValid,
  normalizeDisplayName,
  normalizeUsername,
  usernameIssue,
  type AccountErrorKind,
  type Profile,
} from '../../domain/account';
import { NewPasswordForm, SignedOut } from './AuthForms';
import { SecuritySection } from './SecuritySection';
import { PasswordField } from './PasswordField';
import { RowButton } from './RowButton';
import { SunsetScene } from './SunsetScene';
import { Avatar } from '../profile/Avatar';
import { useProfile } from '../profile/usePhoto';
import { clearRecovery, markRecovery, useRecovery } from './recoveryState';
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
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const founder = useMyBadges(user.id).includes('founder');
  const [deleting, setDeleting] = useState(false);
  // Profilbild liegt auf dem Gerät (eigenes Profil)
  const localProfile = useProfile();

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
      <section className={styles.hero} aria-label={t.detailsTitle}>
        <SunsetScene />
        <span className={styles.heroAvatar}>
          <Avatar photoId={localProfile?.avatarPhotoId} size={76} />
          <Link to="/profil/bearbeiten" className={styles.heroEdit} aria-label={t.editProfile}>
            <PencilIcon size={16} />
          </Link>
        </span>
        <div className={styles.profile}>
          <strong className={styles.displayName}>{profile.displayName}</strong>
          {founder && <FounderBadge variant="full" />}
          <span className="muted">{t.usernameShown(profile.username)}</span>
          <span className={`muted ${styles.small} ${styles.mailLine}`}>
            <MailIcon size={16} />
            <span className="visually-hidden">{t.emailLabel}: </span>
            {user.email}
          </span>
          <span className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            {t.statusActive}
          </span>
        </div>
      </section>
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
        <div className={styles.twoButtons}>
          <Button
            variant="secondary"
            icon={<PencilIcon size={18} />}
            onClick={() => {
              setName(profile.displayName);
              setEditing(true);
            }}
          >
            {t.editDisplayName}
          </Button>
          <Button
            variant="secondary"
            icon={<ExitIcon size={18} />}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                // dieses Gerät bekommt danach keine Mitteilungen mehr für das Konto
                await unregisterDevice(account).catch(() => undefined);
                await account.signOut();
              })
            }
          >
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

      <SecuritySection account={account} user={user} />

      <section className={styles.group} aria-labelledby="acc-follow">
        <h2 id="acc-follow" className={styles.groupTitle}>
          <FeedIcon size={22} />
          {t.followTitle}
        </h2>
        <div className={pageStyles.card}>
          <ListLink
            to="/profil/freunde"
            icon={<FeedIcon />}
            title={t.followManage}
            hint={t.followManageHint}
          />
        </div>
      </section>

      <section className={styles.danger} aria-labelledby="acc-delete">
        <h2 id="acc-delete" className="visually-hidden">
          {t.deleteTitle}
        </h2>
        <div className={pageStyles.card}>
          <RowButton
            danger
            icon={<TrashIcon />}
            title={t.deleteTitle}
            hint={t.deleteRowHint}
            expanded={deleting}
            onClick={() => setDeleting((v) => !v)}
          />
        </div>
        {deleting && (
          <div className={styles.form}>
            <p className="muted">{t.deleteText}</p>
            <TextField
              label={t.deleteConfirmLabel(profile.username)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {user.hasPassword ? (
              <PasswordField
                label={t.deletePasswordLabel}
                value={deletePassword}
                onValue={setDeletePassword}
                error={deleteError}
              />
            ) : (
              <p className="muted">{t.security.needsPassword}</p>
            )}
            <div>
              <Button
                variant="danger"
                disabled={
                  busy ||
                  normalizeUsername(confirm) !== profile.username ||
                  !user.hasPassword ||
                  !deletePassword
                }
                onClick={() =>
                  void run(async () => {
                    setDeleteError(undefined);
                    // vor dem endgültigen Löschen das Passwort erneut prüfen
                    if (!(await account.verifyPassword(deletePassword)))
                      return setDeleteError(t.security.wrongCurrent);
                    onDeleted();
                    await account.deleteAccount();
                  })
                }
              >
                {t.deleteButton}
              </Button>
            </div>
          </div>
        )}
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
  // Anmelde-Link mit Fehler (z. B. abgelaufen): Hinweis zeigen und den #-Teil entfernen
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [link] = useState(() => authLinkInHash(hash));
  const linkError = link?.kind === 'error' ? link.reason : undefined;
  // Link aus „Passwort vergessen?“: nach der Anmeldung direkt das neue Passwort abfragen
  const [linkConfirmed] = useState(() => link?.kind === 'session' && link.type === 'signup');
  useEffect(() => {
    if (link?.kind === 'session' && link.type === 'recovery') markRecovery();
    if (linkError) navigate('/mehr/konto', { replace: true });
  }, [link, linkError, navigate]);
  const recovering = useRecovery();

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
  // Abzeichen kommen nur vom Server: bei Anmeldung neu lesen, bei Abmeldung vergessen
  useEffect(() => {
    if (uid) void refreshBadges(account, uid);
    else if (user === null) {
      clearBadges();
      clearSharedSpots();
    }
  }, [account, uid, user]);
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
    <Page title={user && profile && !recovering ? t.detailsTitle : t.title} back="/mehr">
      {!(user && profile) && <p className="muted">{t.intro}</p>}
      {!account.enabled ? (
        <Notice>{t.disabled}</Notice>
      ) : (
        <div className={styles.stack}>
          {!online && <Notice tone="warning">{t.offline}</Notice>}
          {linkConfirmed && user && <Notice tone="success">{t.linkConfirmed}</Notice>}
          {linkError && user === null && (
            <Notice tone="error">{linkError === 'expired' ? t.linkExpired : t.errors.unknown}</Notice>
          )}
          {user === undefined ? (
            <p className="muted">{t.loading}</p>
          ) : user === null ? (
            <>
              {wasSignedIn && (
                <p className="muted" role="status">
                  {deleted ? t.deleted : t.signedOut}
                </p>
              )}
              <SignedOut account={account} />
            </>
          ) : recovering ? (
            <NewPasswordForm
              account={account}
              email={user.email}
              title={t.setPasswordTitle}
              onDone={() => clearRecovery()}
            />
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

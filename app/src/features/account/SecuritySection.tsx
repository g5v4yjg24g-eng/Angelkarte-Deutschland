// Mehr → Konto → Sicherheit (Wunsch Nutzer 2026-11-10): Passwort festlegen/ändern (mit aktuellem Passwort),
// E-Mail-Adresse ändern (Passwort erneut, Bestätigung an alte und neue Adresse), auf allen anderen Geräten abmelden.
import { useState, type FormEvent } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextField } from '../../design/components/Field';
import type { AccountProvider, AccountUser } from '../../ports/account';
import { accountErrorKind, normalizeEmail, passwordIssue, validEmail } from '../../domain/account';
import { NewPasswordForm } from './AuthForms';
import { PasswordField } from './PasswordField';
import { RowButton } from './RowButton';
import { DevicesIcon, LockIcon, MailIcon, ShieldIcon } from '../../design/icons';
import pageStyles from '../../design/components/Page.module.css';
import styles from './Account.module.css';

const t = de.account;
const ts = t.security;
const errorText = (e: unknown) =>
  t.errors[accountErrorKind(e as { message?: string; status?: number; code?: string })];

type Open = 'password' | 'email' | undefined;

export function SecuritySection({ account, user }: { account: AccountProvider; user: AccountUser }) {
  const [open, setOpen] = useState<Open>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const done = (msg: string) => {
    setOpen(undefined);
    setStatus(msg);
  };

  return (
    <section className={styles.group} aria-labelledby="acc-security">
      <h2 id="acc-security" className={styles.groupTitle}>
        <ShieldIcon size={22} />
        {ts.title}
      </h2>
      {!user.hasPassword && open !== 'password' && (
        <Notice tone="warning">
          <strong>{ts.noPasswordTitle}</strong> {ts.noPasswordText}
        </Notice>
      )}
      {user.newEmail && <p className="muted">{ts.emailPending(user.newEmail)}</p>}

      {open === 'password' ? (
        <div className={pageStyles.card}>
          <div className={styles.sectionCard}>
            {user.hasPassword ? (
              <ChangePasswordForm
                account={account}
                email={user.email}
                onDone={() => done(t.passwordSaved)}
                onCancel={() => setOpen(undefined)}
              />
            ) : (
              <NewPasswordForm
                account={account}
                email={user.email}
                title={ts.setPassword}
                onDone={() => done(t.passwordSaved)}
                onCancel={() => setOpen(undefined)}
              />
            )}
          </div>
        </div>
      ) : open === 'email' ? (
        <div className={pageStyles.card}>
          <div className={styles.sectionCard}>
            <ChangeEmailForm
              account={account}
              user={user}
              onDone={(to) => done(ts.emailChangeSent(to))}
              onCancel={() => setOpen(undefined)}
            />
          </div>
        </div>
      ) : (
        <div className={pageStyles.card}>
          <RowButton
            icon={<LockIcon />}
            title={user.hasPassword ? ts.changePassword : ts.setPassword}
            onClick={() => {
              setStatus(undefined);
              setOpen('password');
            }}
          />
          <RowButton
            icon={<MailIcon />}
            title={ts.changeEmail}
            onClick={() => {
              setStatus(undefined);
              setOpen('email');
            }}
          />
          <RowButton
            icon={<DevicesIcon />}
            title={ts.signOutOthers}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(undefined);
              setStatus(undefined);
              account
                .signOutOthers()
                .then(() => setStatus(ts.signedOutOthers))
                .catch((e: unknown) => setError(errorText(e)))
                .finally(() => setBusy(false));
            }}
          />
        </div>
      )}
      {status && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <p className={`muted ${styles.small} ${styles.note}`}>
        <ShieldIcon size={16} />
        {ts.notifyNote}
      </p>
    </section>
  );
}

function ChangePasswordForm({
  account,
  email,
  onDone,
  onCancel,
}: {
  account: AccountProvider;
  email: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [currentError, setCurrentError] = useState<string>();
  const [nextError, setNextError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setCurrentError(current ? undefined : t.passwordMissing);
    const issue = passwordIssue(next, email);
    setNextError(issue ? t.passwordIssues[issue] : undefined);
    if (!current || issue) return;
    setBusy(true);
    setError(undefined);
    void (async () => {
      try {
        if (!(await account.verifyPassword(current))) return setCurrentError(ts.wrongCurrent);
        await account.setPassword(next);
        onDone();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <h3 className={styles.h2}>{ts.changePassword}</h3>
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <PasswordField label={t.currentPasswordLabel} value={current} onValue={setCurrent} error={currentError} />
      <PasswordField
        label={t.newPasswordLabel}
        hint={t.passwordHint}
        isNew
        email={email}
        value={next}
        onValue={setNext}
        error={nextError}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy}>
          {busy ? t.working : t.setPasswordSave}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

function ChangeEmailForm({
  account,
  user,
  onDone,
  onCancel,
}: {
  account: AccountProvider;
  user: AccountUser;
  onDone: (to: string) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!user.hasPassword)
    return (
      <div className={styles.form}>
        <Notice>{ts.needsPassword}</Notice>
        <div>
          <Button variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
        </div>
      </div>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const to = normalizeEmail(email);
    setEmailError(!validEmail(email) ? t.emailInvalid : to === normalizeEmail(user.email) ? ts.sameEmail : undefined);
    setPasswordError(password ? undefined : t.passwordMissing);
    if (!validEmail(email) || to === normalizeEmail(user.email) || !password) return;
    setBusy(true);
    setError(undefined);
    void (async () => {
      try {
        // vor dem Ändern der Adresse das Passwort erneut prüfen
        if (!(await account.verifyPassword(password))) return setPasswordError(ts.wrongCurrent);
        await account.changeEmail(to);
        onDone(to);
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <h3 className={styles.h2}>{ts.changeEmail}</h3>
      <TextField
        label={ts.newEmailLabel}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={email}
        error={emailError}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordField label={t.currentPasswordLabel} value={password} onValue={setPassword} error={passwordError} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy}>
          {busy ? t.working : ts.changeEmail}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

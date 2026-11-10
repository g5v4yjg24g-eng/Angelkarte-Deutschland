// Anmeldung mit E-Mail und Passwort (Wunsch Nutzer 2026-11-10, ersetzt die Code-Anmeldung): Anmelden, Registrieren
// (Bestätigung per Link oder Code, 10 Minuten), „Passwort vergessen?“ (Link oder Code) und das neue Passwort danach.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { TextField } from '../../design/components/Field';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { RulesConsent } from '../moderation/Rules';
import { acceptRules, loadCurrentRules, rulesAccepted } from '../moderation/rulesConsent';
import type { CommunityRules } from '../../domain/communityRules';
import type { AccountProvider } from '../../ports/account';
import {
  accountErrorKind,
  normalizeCode,
  normalizeEmail,
  passwordIssue,
  resendIn,
  validCode,
  validEmail,
} from '../../domain/account';
import { useNow } from '../../lib/useNow';
import { PasswordField } from './PasswordField';
import { clearRecovery, markRecovery } from './recoveryState';
import styles from './Account.module.css';

const t = de.account;
const kindOf = (e: unknown) => accountErrorKind(e as { message?: string; status?: number; code?: string });
const errorText = (e: unknown) => t.errors[kindOf(e)];

type Step =
  | { kind: 'signIn' }
  | { kind: 'signUp' }
  | { kind: 'confirm'; email: string; sentAt: number }
  | { kind: 'forgot' }
  | { kind: 'resetCode'; email: string; sentAt: number };

export function SignedOut({ account }: { account: AccountProvider }) {
  const [step, setStep] = useState<Step>({ kind: 'signIn' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  // Regeln der Community vor dem Registrieren (Wunsch Nutzer 2026-11-03): Ablehnen verschickt nichts
  // aktuelle Fassung vom Server (beim Registrieren gibt es ohnehin Netz); undefined = Fenster zu
  const [askRules, setAskRules] = useState<CommunityRules>();
  const [declined, setDeclined] = useState(false);
  const now = useNow(1000);

  const clearErrors = () => {
    setError(undefined);
    setEmailError(undefined);
    setPasswordError(undefined);
    setCodeError(undefined);
  };
  const go = (s: Step) => {
    clearErrors();
    setCode('');
    setStep(s);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const checkEmail = () => {
    if (validEmail(email)) return normalizeEmail(email);
    setEmailError(t.emailInvalid);
    return undefined;
  };

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    const to = checkEmail();
    if (!password) setPasswordError(t.passwordMissing);
    if (!to || !password) return;
    void run(async () => {
      try {
        await account.signIn(to, password);
      } catch (err) {
        // noch nicht bestätigt: neue Bestätigungsmail und gleich zur Code-Eingabe
        if (kindOf(err) !== 'notConfirmed') throw err;
        await account.resendConfirmation(to).catch(() => undefined);
        go({ kind: 'confirm', email: to, sentAt: Date.now() });
        setError(t.errors.notConfirmed);
      }
    });
  };

  const register = (to: string) =>
    run(async () => {
      await account.signUp(to, password);
      go({ kind: 'confirm', email: to, sentAt: Date.now() });
    });
  const signUp = (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    setDeclined(false);
    const to = checkEmail();
    const issue = passwordIssue(password, email);
    if (issue) setPasswordError(t.passwordIssues[issue]);
    if (!to || issue) return;
    void loadCurrentRules(account).then((rules) => {
      if (rulesAccepted(rules.version)) void register(to);
      else setAskRules(rules);
    });
  };

  const submitCode = (e: FormEvent, fn: (c: string) => Promise<unknown>) => {
    e.preventDefault();
    if (!validCode(code)) return setCodeError(t.codeInvalid);
    setCodeError(undefined);
    void run(async () => {
      await fn(normalizeCode(code));
    });
  };

  const forgot = (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    const to = checkEmail();
    if (!to) return;
    void run(async () => {
      await account.requestPasswordReset(to);
      go({ kind: 'resetCode', email: to, sentAt: Date.now() });
    });
  };

  const emailField = (
    <TextField
      label={t.emailLabel}
      type="email"
      inputMode="email"
      autoComplete="username"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      value={email}
      error={emailError}
      onChange={(e) => setEmail(e.target.value)}
    />
  );
  const errorNotice = error && <Notice tone="error">{error}</Notice>;

  if (step.kind === 'confirm' || step.kind === 'resetCode') {
    const confirm = step.kind === 'confirm';
    const wait = resendIn(step.sentAt, now);
    return (
      <form
        className={styles.form}
        noValidate
        onSubmit={(e) =>
          submitCode(e, (c) =>
            confirm
              ? account.confirmSignUp(step.email, c)
              : // Merker vorher setzen: die Anmeldung kommt sonst vor ihm an und zeigt kurz das Profil
                (markRecovery(),
                account.confirmPasswordReset(step.email, c).catch((err: unknown) => {
                  clearRecovery();
                  throw err;
                })),
          )
        }
      >
        <h2 className={styles.h2}>{confirm ? t.confirmTitle : t.setPasswordTitle}</h2>
        <Notice>{confirm ? t.confirmSent(step.email) : t.resetSent(step.email)}</Notice>
        <TextField
          label={t.codeLabel}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          value={code}
          error={codeError}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {errorNotice}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy}>
            {busy ? t.working : t.verify}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || wait > 0}
            onClick={() =>
              void run(async () => {
                if (confirm) await account.resendConfirmation(step.email);
                else await account.requestPasswordReset(step.email);
                setStep({ ...step, sentAt: Date.now() });
              })
            }
          >
            {wait > 0 ? t.resendIn(wait) : t.resend}
          </Button>
          <Button type="button" variant="ghost" onClick={() => go({ kind: 'signIn' })}>
            {t.back}
          </Button>
        </div>
      </form>
    );
  }

  if (step.kind === 'forgot')
    return (
      <form className={styles.form} noValidate onSubmit={forgot}>
        <h2 className={styles.h2}>{t.resetTitle}</h2>
        <p className="muted">{t.resetIntro}</p>
        {emailField}
        {errorNotice}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy}>
            {busy ? t.working : t.resetSend}
          </Button>
          <Button type="button" variant="ghost" onClick={() => go({ kind: 'signIn' })}>
            {t.back}
          </Button>
        </div>
      </form>
    );

  const signingUp = step.kind === 'signUp';
  return (
    <>
      <div className={styles.tabs}>
        <SegmentedControl
          label={t.tabs.signIn}
          value={step.kind}
          onChange={(v) => go({ kind: v })}
          options={[
            { value: 'signIn', label: t.tabs.signIn },
            { value: 'signUp', label: t.tabs.signUp },
          ]}
        />
      </div>
      <form className={styles.form} noValidate onSubmit={signingUp ? signUp : signIn}>
        {signingUp && <p className="muted">{t.signUpIntro}</p>}
        {emailField}
        <PasswordField
          label={t.passwordLabel}
          hint={signingUp ? t.passwordHint : undefined}
          isNew={signingUp}
          email={email}
          value={password}
          onValue={setPassword}
          error={passwordError}
        />
        {errorNotice}
        {declined && <Notice>{de.moderation.declined}</Notice>}
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? t.working : signingUp ? t.signUp : t.signIn}
          </Button>
        </div>
        {!signingUp && (
          <>
            <button type="button" className={styles.linkButton} onClick={() => go({ kind: 'forgot' })}>
              {t.forgot}
            </button>
            <p className={`muted ${styles.small}`}>{t.noPasswordYet}</p>
          </>
        )}
        <p>
          <Link to="/mehr/regeln">{de.moderation.rulesLink}</Link>
        </p>
      </form>
      <RulesConsent
        open={!!askRules}
        rules={askRules}
        onAccept={() => {
          acceptRules(askRules?.version);
          setAskRules(undefined);
          const to = checkEmail();
          if (to) void register(to);
        }}
        onDecline={() => {
          setAskRules(undefined);
          setDeclined(true);
        }}
      />
    </>
  );
}

/** Neues Passwort nach „Passwort vergessen?“ (Code oder Link) bzw. erstes Passwort für Konten aus der Code-Zeit */
export function NewPasswordForm({
  account,
  email,
  title,
  intro,
  onDone,
  onCancel,
}: {
  account: AccountProvider;
  email: string;
  title: string;
  intro?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const issue = passwordIssue(password, email);
        if (issue) return setFieldError(t.passwordIssues[issue]);
        setFieldError(undefined);
        setBusy(true);
        setError(undefined);
        account
          .setPassword(password)
          .then(onDone)
          .catch((err: unknown) => setError(errorText(err)))
          .finally(() => setBusy(false));
      }}
    >
      <h2 className={styles.h2}>{title}</h2>
      {intro && <p className="muted">{intro}</p>}
      {/* für den Schlüsselbund: zu welchem Konto das neue Passwort gehört */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <PasswordField
        label={t.newPasswordLabel}
        hint={t.passwordHint}
        isNew
        email={email}
        value={password}
        onValue={setPassword}
        error={fieldError}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy}>
          {busy ? t.working : t.setPasswordSave}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

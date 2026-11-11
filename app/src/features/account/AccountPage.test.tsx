import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Profile } from '../../domain/account';
import type { Badge } from '../../domain/badges';
import { AccountError, type AccountProvider, type AccountUser } from '../../ports/account';
import { ProvidersContext, type Providers } from '../../ports/providersContext';
import { AccountPage } from './AccountPage';

const PW = 'Zander am Abend 7';

/** Anbieter im Speicher: Konten mit Passwort, Bestätigungs-/Passwort-Code 123456, belegter Name „hecht“ */
type FakeAccount = AccountProvider & {
  calls: string[];
  seed: (email: string, password?: string | null) => void;
  login: (email: string) => AccountUser;
};
function fakeAccount(badges: Badge[] = []): FakeAccount {
  let user: AccountUser | null = null;
  let profile: Profile | null = null;
  // E-Mail → Passwort (null = Konto aus der Code-Zeit ohne Passwort), bestätigt?
  const accounts = new Map<string, { password: string | null; confirmed: boolean }>();
  const signInAs = (email: string) => {
    const a = accounts.get(email);
    user = { id: 'u1', email, hasPassword: !!a?.password };
    emit();
    return user;
  };
  const listeners = new Set<(u: AccountUser | null) => void>();
  const emit = () => listeners.forEach((l) => l(user));
  const calls: string[] = [];
  const fake: AccountProvider & { calls: string[] } = {
    calls,
    enabled: true,
    currentUser: () => Promise.resolve(user),
    onChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    signIn: (email, password) => {
      const a = accounts.get(email);
      if (!a || a.password !== password)
        return Promise.reject(new AccountError('Invalid login credentials', 400, 'invalid_credentials'));
      if (!a.confirmed) return Promise.reject(new AccountError('Email not confirmed', 400, 'email_not_confirmed'));
      return Promise.resolve(signInAs(email));
    },
    signUp: (email, password) => {
      calls.push(`signup:${email}`);
      accounts.set(email, { password, confirmed: false });
      return Promise.resolve();
    },
    confirmSignUp: (email, code) => {
      const a = accounts.get(email);
      if (code !== '123456' || !a) return Promise.reject(new AccountError('Token has expired or is invalid', 403));
      a.confirmed = true;
      return Promise.resolve(signInAs(email));
    },
    resendConfirmation: (email) => {
      calls.push(`resend:${email}`);
      return Promise.resolve();
    },
    requestPasswordReset: (email) => {
      calls.push(`reset:${email}`);
      return Promise.resolve();
    },
    confirmPasswordReset: (email, code) => {
      if (code !== '123456' || !accounts.has(email))
        return Promise.reject(new AccountError('Token has expired or is invalid', 403));
      return Promise.resolve(signInAs(email));
    },
    setPassword: (password) => {
      calls.push('setPassword');
      if (!user) return Promise.reject(new AccountError('not signed in', 401));
      accounts.set(user.email, { password, confirmed: true });
      signInAs(user.email);
      return Promise.resolve();
    },
    verifyPassword: (password) => Promise.resolve(!!user && accounts.get(user.email)?.password === password),
    changeEmail: (email) => {
      calls.push(`changeEmail:${email}`);
      if (user) {
        user = { ...user, newEmail: email };
        emit();
      }
      return Promise.resolve();
    },
    signOutOthers: () => {
      calls.push('signOutOthers');
      return Promise.resolve();
    },
    signOut: () => {
      user = null;
      emit();
      return Promise.resolve();
    },
    getProfile: () => Promise.resolve(profile),
    usernameAvailable: (n) => Promise.resolve(n !== 'hecht'),
    createProfile: (username, displayName) => {
      profile = { id: 'u1', username, displayName };
      return Promise.resolve(profile);
    },
    updateDisplayName: (displayName) => {
      profile = { ...(profile as Profile), displayName };
      return Promise.resolve(profile);
    },
    friends: () => Promise.resolve([]),
    follows: () => Promise.resolve([]),
    follow: () => Promise.resolve('requested'),
    unfollow: () => Promise.resolve(),
    removeFollower: () => Promise.resolve(),
    respondFollowRequest: () => Promise.resolve(),
    followCounts: () => Promise.resolve({ followers: 0, following: 0, requests: 0 }),
    accountPrivate: () => Promise.resolve(true),
    setAccountPrivate: () => Promise.resolve(),
    publishPost: () => Promise.resolve(),
    updateSharedPost: () => Promise.resolve(),
    deleteSharedPost: () => Promise.resolve(),
    downloadPostPhotos: () => Promise.resolve(undefined),
    feed: () => Promise.resolve([]),
    sharedSpots: () => Promise.resolve([]),
    shareSpot: () => Promise.resolve(),
    unshareSpot: () => Promise.resolve(),
    report: () => Promise.resolve(),
    blockUser: () => Promise.resolve(),
    unblockUser: () => Promise.resolve(),
    blockedUsers: () => Promise.resolve([]),
    postReactions: () => Promise.resolve(new Map()),
    toggleLike: () => Promise.resolve(true),
    postComments: () => Promise.resolve([]),
    addComment: () => Promise.resolve(),
    deleteComment: () => Promise.resolve(),
    registerPushDevice: () => Promise.resolve(),
    unregisterPushDevice: () => Promise.resolve(),
    pushPrefs: () =>
      Promise.resolve({
        friends: true,
        likes: true,
        comments: true,
        spots: true,
        sessions: true,
        posts: true,
      }),
    setPushPrefs: () => Promise.resolve(),
    sendTestPush: () => Promise.resolve(1),
    pushStatus: () => Promise.resolve({ devices: 1 }),
    isModerator: () => Promise.resolve(false),
    modReports: () => Promise.resolve([]),
    modOverview: () => Promise.resolve({ openReports: 0 }),
    modSetReportStatus: () => Promise.resolve(),
    modReportReporter: () => Promise.resolve(undefined),
    modReportLog: () => Promise.resolve([]),
    modHidePost: () => Promise.resolve(),
    modRestorePost: () => Promise.resolve(),
    modPostState: () => Promise.resolve(undefined),
    modContent: () => Promise.resolve(undefined),
    modUser: () => Promise.resolve(undefined),
    modUserContent: () => Promise.resolve([]),
    modUserLog: () => Promise.resolve([]),
    modPhotoUrls: () => Promise.resolve([]),
    modDeleteContent: () => Promise.resolve(),
    modAddWarning: () => Promise.resolve(),
    modRevokeWarning: () => Promise.resolve(),
    modUserWarnings: () => Promise.resolve([]),
    modUsers: () => Promise.resolve([]),
    modCanSearchEmail: () => Promise.resolve(false),
    modMyRole: () => Promise.resolve(undefined),
    modRoles: () => Promise.resolve([]),
    modBlockedNames: () => Promise.resolve([]),
    modAddBlockedName: () => Promise.resolve(),
    modRemoveBlockedName: () => Promise.resolve(),
    modLogList: () => Promise.resolve([]),
    modStats: () => Promise.resolve(undefined),
    currentRules: () => Promise.resolve(undefined),
    myRulesConsent: () => Promise.resolve(0),
    acceptRules: () => Promise.resolve(),
    modRulesHistory: () => Promise.resolve([]),
    modPublishRules: () => Promise.resolve(2),
    appealInfo: () => Promise.resolve({ state: 'invalid' as const }),
    submitAppeal: () => Promise.resolve(),
    modAppeals: () => Promise.resolve([]),
    modDecideAppeal: () => Promise.resolve(),
    modResolve: () => Promise.resolve(),
    modPasswordNotice: () => Promise.resolve({ pending: 0, sent: 0, failed: 0 }),
    modBan: () => Promise.resolve(),
    modUnban: () => Promise.resolve(),
    publishAvatar: () => Promise.resolve(),
    toggleSave: () => Promise.resolve(true),
    savedIds: () => Promise.resolve(new Set<string>()),
    savedPosts: () => Promise.resolve([]),
    discoverFeed: () => Promise.resolve([]),
    createGroupSession: () => Promise.resolve('g1'),
    inviteToGroupSession: () => Promise.resolve(0),
    respondGroupInvite: () => Promise.resolve(),
    leaveGroupSession: () => Promise.resolve(),
    endGroupSession: () => Promise.resolve(),
    myGroupSessions: () => Promise.resolve([]),
    groupSessionMembers: () => Promise.resolve([]),
    groupHighlights: () => Promise.resolve([]),
    setProfileExtras: () => Promise.resolve(),
    userProfile: () => Promise.resolve(null),
    userPosts: () => Promise.resolve([]),
    searchUsers: () => Promise.resolve([]),
    setMyAchievements: () => Promise.resolve(),
    myAchievementsVisibility: () => Promise.resolve('friends'),
    setMyAchievementsVisibility: () => Promise.resolve(),
    userAchievements: () => Promise.resolve({ visible: false }),
    modProfileText: () => Promise.resolve(undefined),
    modClearProfile: () => Promise.resolve(),
    avatarUrls: () => Promise.resolve(new Map()),
    modClearAvatar: () => Promise.resolve(),
    myBadges: () => (user ? Promise.resolve(badges) : Promise.reject(new AccountError('not signed in', 401))),
    deleteAccount: () => {
      calls.push('delete');
      user = null;
      profile = null;
      emit();
      return Promise.resolve();
    },
  };
  return Object.assign(fake, {
    /** Konto direkt anlegen (bestätigt); `password: null` = Konto aus der Code-Zeit */
    seed: (email: string, password: string | null = PW) => {
      accounts.set(email, { password, confirmed: true });
    },
    login: (email: string) => signInAs(email),
  });
}

// jsdom kennt <dialog>.showModal nur eingeschränkt (Regeln-Fenster): minimal nachbilden
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  setTimeout(() => this.dispatchEvent(new Event('close')), 0);
};

const renderWith = (account: AccountProvider) =>
  render(
    <ProvidersContext.Provider value={{ account } as unknown as Providers}>
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    </ProvidersContext.Provider>,
  );

describe('Mehr → Konto (ACC-2)', () => {
  it('registrieren mit Passwort, Bestätigungscode, Profil anlegen, Anzeigename ändern, abmelden, wieder anmelden', async () => {
    const acc = fakeAccount();
    renderWith(acc);
    fireEvent.click(await screen.findByRole('radio', { name: 'Registrieren' }));
    const email = screen.getByRole('textbox', { name: 'E-Mail-Adresse' });
    fireEvent.change(email, { target: { value: 'kein-mail' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'kurz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }));
    expect(screen.getByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeInTheDocument();
    expect(screen.getByText('Mindestens 10 Zeichen.')).toBeInTheDocument();
    fireEvent.change(email, { target: { value: ' Max@Example.de ' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'passwort123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }));
    expect(screen.getByText(/Zu leicht zu erraten/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: PW } });
    expect(screen.getByText(/Stärke: (Gut|Stark)/)).toBeInTheDocument();
    // Regeln der Community: Ablehnen verschickt nichts (Wunsch Nutzer 2026-11-03)
    localStorage.removeItem('fangpunkt.rulesAccepted');
    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ablehnen' }));
    expect(await screen.findByText(/Es wurde keine E-Mail verschickt/)).toBeInTheDocument();
    expect(acc.calls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Akzeptieren' }));
    expect(await screen.findByText(/E-Mail an max@example\.de geschickt/)).toBeInTheDocument();
    expect(acc.calls).toEqual(['signup:max@example.de']);
    expect(screen.getByRole('button', { name: /Erneut senden in \d+ s möglich/ })).toBeDisabled();

    const code = screen.getByRole('textbox', { name: 'Code aus der E-Mail' });
    fireEvent.change(code, { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByText(/Der Code ist falsch oder abgelaufen/)).toBeInTheDocument();
    fireEvent.change(code, { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(await screen.findByRole('heading', { name: 'Profil anlegen' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Nutzername' });
    fireEvent.change(name, { target: { value: 'hecht' } });
    expect(await screen.findByText('Dieser Nutzername ist vergeben oder nicht erlaubt.')).toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'Zander.Max' } });
    expect(await screen.findByText('Frei.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Anzeigename' }), { target: { value: ' Max ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Profil speichern' }));

    expect(await screen.findByText('@zander.max')).toBeInTheDocument();
    expect(screen.getByText('Angemeldet als max@example.de')).toBeInTheDocument();
    // neues Konto hat ein Passwort: kein Hinweis
    expect(screen.queryByText('Lege ein Passwort fest')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigename ändern' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Anzeigename' }), { target: { value: 'Max M.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Max M.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(await screen.findByText('Du bist abgemeldet.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'E-Mail-Adresse' }), {
      target: { value: 'max@example.de' },
    });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'falsch-falsch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByText('E-Mail-Adresse oder Passwort stimmen nicht.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: PW } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByText('@zander.max')).toBeInTheDocument();
  });

  it('Passwort vergessen: Code aus der Mail, dann neues Passwort; Konto aus der Code-Zeit genauso', async () => {
    const acc = fakeAccount();
    acc.seed('alt@example.de', null);
    await acc.createProfile('alt', 'Alt');
    await acc.signOut();
    renderWith(acc);
    expect(await screen.findByText(/bisher mit einem Code angemeldet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Passwort vergessen?' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'E-Mail-Adresse' }), {
      target: { value: 'alt@example.de' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link senden' }));
    expect(await screen.findByText(/Falls es ein Konto mit alt@example\.de gibt/)).toBeInTheDocument();
    expect(acc.calls).toEqual(['reset:alt@example.de']);
    fireEvent.change(screen.getByRole('textbox', { name: 'Code aus der E-Mail' }), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    expect(await screen.findByRole('heading', { name: 'Neues Passwort festlegen' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: PW } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));
    expect(await screen.findByText('@alt')).toBeInTheDocument();
    expect(acc.calls).toContain('setPassword');
    expect(sessionStorage.getItem('fangpunkt.passwordRecovery')).toBeNull();
  });

  it('noch angemeldetes Konto ohne Passwort: Hinweis, Passwort festlegen; danach ändern nur mit dem aktuellen', async () => {
    const acc = fakeAccount();
    acc.seed('alt@example.de', null);
    acc.login('alt@example.de');
    await acc.createProfile('alt', 'Alt');
    renderWith(acc);
    expect(await screen.findByText('Lege ein Passwort fest')).toBeInTheDocument();
    // E-Mail ändern und Löschen brauchen erst ein Passwort
    expect(screen.getByRole('button', { name: 'Konto endgültig löschen' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Passwort festlegen' }));
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: PW } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));
    expect(await screen.findByText(/Passwort gespeichert/)).toBeInTheDocument();
    expect(screen.queryByText('Lege ein Passwort fest')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Passwort ändern' }));
    fireEvent.change(screen.getByLabelText('Aktuelles Passwort'), { target: { value: 'falsch-falsch' } });
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'Barsch im Nebel 42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));
    expect(await screen.findByText('Das aktuelle Passwort stimmt nicht.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Aktuelles Passwort'), { target: { value: PW } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort speichern' }));
    expect(await screen.findByText(/Passwort gespeichert/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Auf allen anderen Geräten abmelden' }));
    expect(await screen.findByText('Auf allen anderen Geräten abgemeldet.')).toBeInTheDocument();
  });

  it('E-Mail-Adresse ändern nur mit Passwort, Bestätigung an beide Adressen', async () => {
    const acc = fakeAccount();
    acc.seed('max@example.de');
    acc.login('max@example.de');
    await acc.createProfile('max', 'Max');
    renderWith(acc);
    fireEvent.click(await screen.findByRole('button', { name: 'E-Mail-Adresse ändern' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Neue E-Mail-Adresse' }), {
      target: { value: 'max@example.de' },
    });
    fireEvent.change(screen.getByLabelText('Aktuelles Passwort'), { target: { value: PW } });
    fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Adresse ändern' }));
    expect(screen.getByText('Das ist schon deine E-Mail-Adresse.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Neue E-Mail-Adresse' }), {
      target: { value: 'Neu@Example.de' },
    });
    fireEvent.change(screen.getByLabelText('Aktuelles Passwort'), { target: { value: 'falsch-falsch' } });
    fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Adresse ändern' }));
    expect(await screen.findByText('Das aktuelle Passwort stimmt nicht.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Aktuelles Passwort'), { target: { value: PW } });
    fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Adresse ändern' }));
    expect(await screen.findByText(/an deine bisherige und an neu@example\.de/)).toBeInTheDocument();
    expect(screen.getByText('Änderung auf neu@example.de wartet auf Bestätigung.')).toBeInTheDocument();
    expect(acc.calls).toContain('changeEmail:neu@example.de');
  });

  it('Konto löschen nur mit Nutzername und Passwort', async () => {
    const acc = fakeAccount();
    acc.seed('max@example.de');
    acc.login('max@example.de');
    await acc.createProfile('zander', 'Max');
    renderWith(acc);
    const del = await screen.findByRole('button', { name: 'Konto endgültig löschen' });
    expect(del).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /deinen Nutzernamen „zander“ eingeben/ }), {
      target: { value: 'Zander' },
    });
    expect(del).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Zum Bestätigen dein Passwort eingeben'), {
      target: { value: 'falsch-falsch' },
    });
    fireEvent.click(del);
    expect(await screen.findByText('Das aktuelle Passwort stimmt nicht.')).toBeInTheDocument();
    expect(acc.calls).not.toContain('delete');
    fireEvent.change(screen.getByLabelText('Zum Bestätigen dein Passwort eingeben'), { target: { value: PW } });
    fireEvent.click(del);
    expect(await screen.findByText('Dein Konto wurde gelöscht.')).toBeInTheDocument();
    expect(acc.calls).toContain('delete');
  });

  it('FOUNDER-Abzeichen nur für das Konto, dem der Server es gibt (BADGE-2)', async () => {
    localStorage.clear();
    const founder = fakeAccount(['founder']);
    founder.seed('kevin@example.de');
    founder.login('kevin@example.de');
    await founder.createProfile('kevin', 'Kevin');
    const { unmount } = renderWith(founder);
    expect(await screen.findByRole('img', { name: /Abzeichen: Founder/ })).toBeInTheDocument();
    expect(screen.getByText('FOUNDER')).toBeInTheDocument();
    unmount();

    // anderes Konto auf demselben Gerät: der gemerkte Stand gehört zu einer anderen Nutzer-ID
    localStorage.setItem(
      'fangpunkt.badges',
      JSON.stringify({ userId: 'u1', badges: ['founder'], checkedAt: 1 }),
    );
    const normal = fakeAccount([]);
    normal.seed('max@example.de');
    normal.login('max@example.de');
    await normal.createProfile('max', 'Max');
    renderWith(normal);
    expect(await screen.findByText('@max')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('img', { name: /Abzeichen: Founder/ })).not.toBeInTheDocument(),
    );
    localStorage.clear();
  });

  it('ohne Einrichtung kein Anmeldeformular', () => {
    renderWith({ ...fakeAccount(), enabled: false });
    expect(screen.getByText('Das Konto ist in dieser Version nicht eingerichtet.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Fehler beim Laden des Profils wird angezeigt', async () => {
    const acc = fakeAccount();
    acc.seed('max@example.de');
    acc.login('max@example.de');
    acc.getProfile = vi.fn(() => Promise.reject(new AccountError('Failed to fetch')));
    renderWith(acc);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Keine Verbindung'));
  });
});

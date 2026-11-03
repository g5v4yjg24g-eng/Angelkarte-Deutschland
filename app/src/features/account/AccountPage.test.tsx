import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Profile } from '../../domain/account';
import { AccountError, type AccountProvider, type AccountUser } from '../../ports/account';
import { ProvidersContext, type Providers } from '../../ports/providersContext';
import { AccountPage } from './AccountPage';

/** Anbieter im Speicher: ein Nutzer, Code 123456, belegter Name „hecht“ */
function fakeAccount(): AccountProvider & { calls: string[] } {
  let user: AccountUser | null = null;
  let profile: Profile | null = null;
  const listeners = new Set<(u: AccountUser | null) => void>();
  const emit = () => listeners.forEach((l) => l(user));
  const calls: string[] = [];
  return {
    calls,
    enabled: true,
    currentUser: () => Promise.resolve(user),
    onChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    requestCode: (email) => {
      calls.push(`code:${email}`);
      return Promise.resolve();
    },
    verifyCode: (email, code) => {
      if (code !== '123456') return Promise.reject(new AccountError('Token has expired or is invalid', 403));
      user = { id: 'u1', email };
      emit();
      return Promise.resolve(user);
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
    deleteAccount: () => {
      calls.push('delete');
      user = null;
      profile = null;
      emit();
      return Promise.resolve();
    },
  };
}

const renderWith = (account: AccountProvider) =>
  render(
    <ProvidersContext.Provider value={{ account } as unknown as Providers}>
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    </ProvidersContext.Provider>,
  );

describe('Mehr → Konto (ACC-2)', () => {
  it('anmelden mit Code, Profil anlegen, Anzeigename ändern, abmelden', async () => {
    const acc = fakeAccount();
    renderWith(acc);
    const email = await screen.findByRole('textbox', { name: 'E-Mail-Adresse' });
    fireEvent.change(email, { target: { value: 'kein-mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Code senden' }));
    expect(screen.getByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeInTheDocument();
    fireEvent.change(email, { target: { value: ' Max@Example.de ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Code senden' }));
    expect(await screen.findByText(/Code an max@example\.de geschickt/)).toBeInTheDocument();
    expect(acc.calls).toEqual(['code:max@example.de']);
    expect(screen.getByRole('button', { name: /Neuer Code in \d+ s möglich/ })).toBeDisabled();

    const code = screen.getByRole('textbox', { name: 'Code aus der E-Mail' });
    fireEvent.change(code, { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByText(/Der Code ist falsch oder abgelaufen/)).toBeInTheDocument();
    fireEvent.change(code, { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('heading', { name: 'Profil anlegen' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Nutzername' });
    fireEvent.change(name, { target: { value: 'hecht' } });
    expect(await screen.findByText('Dieser Nutzername ist schon vergeben.')).toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'Zander.Max' } });
    expect(await screen.findByText('Frei.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Anzeigename' }), { target: { value: ' Max ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Profil speichern' }));

    expect(await screen.findByText('@zander.max')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.getByText('Angemeldet als max@example.de')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anzeigename ändern' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Anzeigename' }), { target: { value: 'Max M.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Max M.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(await screen.findByText('Du bist abgemeldet.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'E-Mail-Adresse' })).toBeInTheDocument();
  });

  it('Konto löschen nur nach Eingabe des Nutzernamens', async () => {
    const acc = fakeAccount();
    await acc.verifyCode('max@example.de', '123456');
    await acc.createProfile('zander', 'Max');
    renderWith(acc);
    const del = await screen.findByRole('button', { name: 'Konto endgültig löschen' });
    expect(del).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /deinen Nutzernamen „zander“ eingeben/ }), {
      target: { value: 'Zander' },
    });
    expect(del).toBeEnabled();
    fireEvent.click(del);
    expect(await screen.findByText('Dein Konto wurde gelöscht.')).toBeInTheDocument();
    expect(acc.calls).toContain('delete');
  });

  it('ohne Einrichtung kein Anmeldeformular', () => {
    renderWith({ ...fakeAccount(), enabled: false });
    expect(screen.getByText('Das Konto ist in dieser Version nicht eingerichtet.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Fehler beim Laden des Profils wird angezeigt', async () => {
    const acc = fakeAccount();
    await acc.verifyCode('max@example.de', '123456');
    acc.getProfile = vi.fn(() => Promise.reject(new AccountError('Failed to fetch')));
    renderWith(acc);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Keine Verbindung'));
  });
});

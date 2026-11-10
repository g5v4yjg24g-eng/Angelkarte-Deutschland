import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_STORAGE_KEY, type AccountProvider } from '../../ports/account';
import type { PushProvider } from '../../ports/push';
import { ProvidersContext, type Providers } from '../../ports/providersContext';
import type { PushPrefs } from '../../domain/push';
import { PushSettings } from './PushSettings';

function setup(
  available: boolean,
  permission: 'granted' | 'denied' | 'prompt' | Error,
  saved: PushPrefs[] = [],
  status: object[] = [],
) {
  const push: PushProvider = {
    available,
    permission: () =>
      permission instanceof Error ? Promise.reject(permission) : Promise.resolve(permission),
    requestPermission: () => Promise.resolve('granted'),
    register: () => Promise.resolve('cd'.repeat(32)),
    onTap: () => () => undefined,
  };
  const account = {
    enabled: true,
    pushPrefs: () =>
      Promise.resolve({
        friends: true,
        likes: true,
        comments: true,
        spots: true,
        sessions: true,
        posts: true,
      }),
    pushStatus: () =>
      Promise.resolve(
        status.length
          ? { devices: 1, test: { at: '2026-11-10T10:00:00Z', ...(status.shift() as object) } }
          : { devices: 1 },
      ),
    sendTestPush: () => Promise.resolve(1),
    setPushPrefs: (p: PushPrefs) => {
      saved.push(p);
      return Promise.resolve();
    },
    registerPushDevice: () => Promise.resolve(),
  } as unknown as AccountProvider;
  render(
    <ProvidersContext.Provider value={{ push, account } as unknown as Providers}>
      <PushSettings />
    </ProvidersContext.Provider>,
  );
  return saved;
}

describe('Einstellungen → Mitteilungen (PUSH-3)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify({ user: { id: 'u-1' } }));
  });

  it('im Browser unsichtbar', () => {
    setup(false, 'granted');
    expect(screen.queryByText('Mitteilungen')).toBeNull();
  });

  it('jede Art einzeln abschaltbar – wird auf dem Server gespeichert', async () => {
    const saved = setup(true, 'granted');
    const likes = await screen.findByRole('checkbox', { name: '„Gefällt mir“ an deinen Beiträgen' });
    expect(likes).toBeChecked();
    fireEvent.click(likes);
    expect(likes).not.toBeChecked();
    expect(saved).toEqual([
      { friends: true, likes: false, comments: true, spots: true, sessions: true, posts: true },
    ]);
  });

  it('noch nicht gefragt: Knopf zum Erlauben; im iPhone abgeschaltet: Hinweis', async () => {
    setup(true, 'prompt');
    expect(await screen.findByRole('button', { name: 'Mitteilungen erlauben' })).toBeInTheDocument();
  });

  it('abgeschaltet: Hinweis auf die iPhone-Einstellungen', async () => {
    setup(true, 'denied');
    await waitFor(() => expect(screen.getByText(/iPhone-Einstellungen → Fangpunkt/)).toBeInTheDocument());
  });

  it('Test-Mitteilung: zeigt, ob das iPhone angemeldet ist und was Apple sagt (PUSH-4)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup(true, 'granted', [], [{}, { sentAt: '2026-11-10T10:00:01Z', error: '403 InvalidProviderToken' }]);
    expect(await screen.findByText('Dieses iPhone ist für Mitteilungen angemeldet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Test-Mitteilung senden' }));
    expect(await screen.findByText(/Test wurde angefragt/)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(4000);
    expect(
      await screen.findByText('Apple hat die Test-Mitteilung abgelehnt: 403 InvalidProviderToken'),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('neue Art „Neue Beiträge von Freunden“ ist dabei', async () => {
    setup(true, 'granted');
    expect(await screen.findByRole('checkbox', { name: 'Neue Beiträge von Freunden' })).toBeChecked();
  });

  it('Fehler bei der Frage nach der Erlaubnis: Meldung sichtbar, Einstellungen und Test trotzdem bedienbar', async () => {
    setup(true, new Error('PushNotifications plugin is not implemented on ios'));
    expect(await screen.findByText(/plugin is not implemented on ios/)).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Neue Beiträge von Freunden' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mitteilungen erlauben' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test-Mitteilung senden' })).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNT_STORAGE_KEY, type AccountProvider } from '../../ports/account';
import type { PushProvider } from '../../ports/push';
import { ProvidersContext, type Providers } from '../../ports/providersContext';
import type { PushPrefs } from '../../domain/push';
import { PushSettings } from './PushSettings';

function setup(available: boolean, permission: 'granted' | 'denied' | 'prompt', saved: PushPrefs[] = []) {
  const push: PushProvider = {
    available,
    permission: () => Promise.resolve(permission),
    requestPermission: () => Promise.resolve('granted'),
    register: () => Promise.resolve('cd'.repeat(32)),
    onTap: () => () => undefined,
  };
  const account = {
    enabled: true,
    pushPrefs: () =>
      Promise.resolve({ friends: true, likes: true, comments: true, spots: true, sessions: true }),
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
    expect(saved).toEqual([{ friends: true, likes: false, comments: true, spots: true, sessions: true }]);
  });

  it('noch nicht gefragt: Knopf zum Erlauben; im iPhone abgeschaltet: Hinweis', async () => {
    setup(true, 'prompt');
    expect(await screen.findByRole('button', { name: 'Mitteilungen erlauben' })).toBeInTheDocument();
  });

  it('abgeschaltet: Hinweis auf die iPhone-Einstellungen', async () => {
    setup(true, 'denied');
    await waitFor(() => expect(screen.getByText(/iPhone-Einstellungen → Fangpunkt/)).toBeInTheDocument());
  });
});

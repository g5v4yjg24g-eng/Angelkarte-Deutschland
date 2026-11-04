import { beforeEach, describe, expect, it } from 'vitest';
import type { AccountProvider } from '../../ports/account';
import type { PushProvider } from '../../ports/push';
import { setupPush, unregisterDevice } from './pushDevice';

const TOKEN = 'ab'.repeat(32);

function fakes(permission: 'granted' | 'denied' | 'prompt', afterRequest: 'granted' | 'denied' = 'granted') {
  const calls: string[] = [];
  let current: string = permission;
  const push: PushProvider = {
    available: true,
    permission: () => Promise.resolve(current as 'granted'),
    requestPermission: () => {
      calls.push('ask');
      current = afterRequest;
      return Promise.resolve(afterRequest);
    },
    register: () => {
      calls.push('register');
      return Promise.resolve(TOKEN.toUpperCase());
    },
    onTap: () => () => undefined,
  };
  const account = {
    registerPushDevice: (t: string) => {
      calls.push(`server:${t}`);
      return Promise.resolve();
    },
    unregisterPushDevice: (t: string) => {
      calls.push(`remove:${t}`);
      return Promise.resolve();
    },
  } as unknown as AccountProvider;
  return { push, account, calls };
}

describe('Gerät für Mitteilungen anmelden (PUSH-2)', () => {
  beforeEach(() => localStorage.clear());

  it('fragt einmal von selbst; mit Erlaubnis meldet es das Token beim Konto an', async () => {
    const f = fakes('prompt');
    await setupPush(f.push, f.account);
    expect(f.calls).toEqual(['ask', 'register', `server:${TOKEN}`]);
    expect(localStorage.getItem('fangpunkt.pushToken')).toBe(TOKEN);
  });

  it('fragt nach einem Nein nicht noch einmal von selbst', async () => {
    const f = fakes('prompt', 'denied');
    await setupPush(f.push, f.account);
    const g = fakes('prompt');
    await setupPush(g.push, g.account);
    expect(f.calls).toEqual(['ask']);
    expect(g.calls).toEqual([]);
  });

  it('ohne Erlaubnis nichts beim Konto; abgeschaltet im iPhone ebenso', async () => {
    const f = fakes('denied');
    await setupPush(f.push, f.account);
    expect(f.calls).toEqual([]);
  });

  it('beim Abmelden vom Konto wird das Token entfernt', async () => {
    const f = fakes('granted');
    await setupPush(f.push, f.account);
    await unregisterDevice(f.account);
    expect(f.calls.at(-1)).toBe(`remove:${TOKEN}`);
    expect(localStorage.getItem('fangpunkt.pushToken')).toBeNull();
    await unregisterDevice(f.account); // ohne Token: nichts
    expect(f.calls.filter((c) => c.startsWith('remove')).length).toBe(1);
  });

  it('im Browser passiert gar nichts', async () => {
    const f = fakes('granted');
    await setupPush({ ...f.push, available: false }, f.account);
    expect(f.calls).toEqual([]);
  });
});

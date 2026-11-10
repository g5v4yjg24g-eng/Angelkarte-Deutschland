// Regression (Nutzer 2026-11-10): Capacitor-Plugins sind Proxys, die auch auf „then“ antworten. Wurde das Plugin aus
// einem Promise zurückgegeben, wartete die Erlaubnis-Abfrage ewig – keine Frage, kein Geräte-Token.
import { describe, expect, it, vi } from 'vitest';

/** wie registerPlugin aus @capacitor/core: jede Eigenschaft ist eine Methode (auch „then“) */
const proxyPlugin = (methods: Record<string, () => Promise<unknown>>) =>
  new Proxy(
    {},
    {
      get: (_, prop: string) =>
        methods[prop] ?? (() => Promise.reject(new Error(`"${prop}" is not implemented`))),
    },
  );

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: proxyPlugin({
    checkPermissions: () => Promise.resolve({ receive: 'prompt' }),
    requestPermissions: () => Promise.resolve({ receive: 'granted' }),
  }),
}));
vi.mock('@capacitor/app', () => ({
  App: proxyPlugin({ getLaunchUrl: () => Promise.resolve({ url: 'https://fangpunkt.com/profil/?u=anna' }) }),
}));

describe('Capacitor-Adapter mit Proxy-Plugins (PUSH-5)', () => {
  it('Erlaubnis abfragen und anfordern antwortet (hängt nicht)', async () => {
    const { capacitorPush } = await import('./capacitorPush');
    const push = capacitorPush();
    expect(push.available).toBe(true);
    await expect(push.permission()).resolves.toBe('prompt');
    await expect(push.requestPermission()).resolves.toBe('granted');
  });
  it('Universal Link beim Start wird gelesen', async () => {
    const { capacitorAppLinks } = await import('./capacitorAppLinks');
    await expect(capacitorAppLinks()?.launchUrl()).resolves.toBe('https://fangpunkt.com/profil/?u=anna');
  });
});

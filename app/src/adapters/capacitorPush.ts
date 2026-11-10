// Push-Mitteilungen über Capacitor (nur in der iPhone-App; Wunsch Nutzer 2026-11-04). Das Plugin wird nur dort
// geladen – im Browser bleibt alles aus und es gibt keinen Netzverkehr.
import { Capacitor } from '@capacitor/core';
import type { PushPermission } from '../domain/push';
import type { PushProvider } from '../ports/push';

// Wichtig: Capacitor-Plugins sind Proxys, die auf jede Eigenschaft antworten – auch auf „then“. Gibt man sie direkt
// aus einem Promise zurück, hält JavaScript sie für ein Promise und wartet ewig (so blieb die Erlaubnis-Abfrage hängen).
// Darum immer in ein Objekt verpackt weiterreichen.
const plugin = () => import('@capacitor/push-notifications').then((m) => ({ push: m.PushNotifications }));

const mapPermission = (p: string): PushPermission =>
  p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';

export function capacitorPush(): PushProvider {
  const available = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  if (!available)
    return {
      available: false,
      permission: () => Promise.resolve('unavailable'),
      requestPermission: () => Promise.resolve('unavailable'),
      register: () => Promise.reject(new Error('Push nicht verfügbar')),
      onTap: () => () => undefined,
    };
  return {
    available: true,
    async permission() {
      return mapPermission((await (await plugin()).push.checkPermissions()).receive);
    },
    async requestPermission() {
      return mapPermission((await (await plugin()).push.requestPermissions()).receive);
    },
    async register() {
      const { push } = await plugin();
      return new Promise<string>((resolve, reject) => {
        let done = false;
        const handles = [
          push.addListener('registration', (t) => {
            done = true;
            resolve(t.value);
            void Promise.all(handles).then((hs) => hs.forEach((h) => void h.remove()));
          }),
          push.addListener('registrationError', (e) => {
            done = true;
            reject(new Error(e.error));
            void Promise.all(handles).then((hs) => hs.forEach((h) => void h.remove()));
          }),
        ];
        void push.register();
        setTimeout(() => !done && reject(new Error('Keine Antwort vom Gerät')), 20_000);
      });
    },
    onTap(listener) {
      let handle: { remove: () => Promise<void> } | undefined;
      let stopped = false;
      void plugin().then(({ push }) =>
        push
          .addListener('pushNotificationActionPerformed', (a) => listener(a.notification.data))
          .then((h) => {
            if (stopped) void h.remove();
            else handle = h;
          }),
      );
      return () => {
        stopped = true;
        void handle?.remove();
      };
    },
  };
}

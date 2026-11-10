// Universal Links über @capacitor/app (nur in der iPhone-App; das Plugin wird nur dort geladen).
import { Capacitor } from '@capacitor/core';
import type { AppLinks } from '../ports/appLinks';

export function capacitorAppLinks(): AppLinks | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  // Plugin verpackt weiterreichen – Capacitor-Proxys antworten auch auf „then“ (siehe capacitorPush.ts)
  const plugin = import('@capacitor/app').then((m) => ({ App: m.App }));
  return {
    launchUrl: () =>
      plugin
        .then(({ App }) => App.getLaunchUrl())
        .then(
          (r) => r?.url,
          () => undefined,
        ),
    onOpen(listener) {
      let remove: (() => void) | undefined;
      let gone = false;
      void plugin
        .then(({ App }) => App.addListener('appUrlOpen', (e) => listener(e.url)))
        .then((h) => {
          if (gone) void h.remove();
          else remove = () => void h.remove();
        })
        .catch(() => undefined);
      return () => {
        gone = true;
        remove?.();
      };
    },
  };
}

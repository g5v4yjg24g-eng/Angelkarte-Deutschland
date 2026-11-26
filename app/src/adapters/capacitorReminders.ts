// Erinnerungen über das eigene Swift-Modul `FangpunktReminders` (UNUserNotificationCenter, nur in der iPhone-App, keine
// fremde Abhängigkeit). Fehler sind egal: eine fehlende Erinnerung darf nie etwas anderes stören.
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { RemindersProvider, ReminderPermission } from '../ports/reminders';

interface RemindersPlugin {
  permission(): Promise<{ status: string }>;
  request(): Promise<{ granted: boolean }>;
  replaceAll(p: { items: { id: string; at: number; title: string; body: string; group?: string; sessionId?: string }[] }): Promise<void>;
}

const isPermission = (s: unknown): s is ReminderPermission =>
  s === 'granted' || s === 'denied' || s === 'prompt';

export function capacitorReminders(): RemindersProvider | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  const plugin = registerPlugin<RemindersPlugin>('FangpunktReminders');
  return {
    permission: () =>
      plugin.permission().then(
        (r) => (isPermission(r.status) ? r.status : 'prompt'),
        () => 'denied' as const,
      ),
    request: () =>
      plugin.request().then(
        (r) => r.granted === true,
        () => false,
      ),
    replaceAll: (items) =>
      plugin
        .replaceAll({ items: items.map(({ id, at, title, body, group, sessionId }) => ({
          id,
          at,
          title,
          body,
          ...(group ? { group } : {}),
          ...(sessionId ? { sessionId } : {}),
        })) })
        .catch(() => undefined),
  };
}

// Antworten von den Knöpfen an Session-Mitteilungen über das eigene Swift-Modul `FangpunktSignals` (nur iPhone-App,
// keine fremde Abhängigkeit). Fehler sind egal: dann bleibt die Meldung einfach in der App sichtbar.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { SignalActionsProvider, SignalAnswer } from '../ports/signalActions';

interface SignalsPlugin {
  takeAnswers(): Promise<{ answers: unknown[] }>;
  addListener(event: 'signalAnswer', listener: () => void): Promise<PluginListenerHandle>;
}

/** Nur vollständige Einträge, Kennung nur aus Hex und Bindestrichen (so sieht sie die Datenbank) */
export function parseSignalAnswers(raw: readonly unknown[] | null | undefined): SignalAnswer[] {
  return (raw ?? []).flatMap((r) => {
    const o = r as { signal?: unknown; accept?: unknown; at?: unknown } | null;
    if (
      typeof o?.signal !== 'string' ||
      !/^[0-9a-f-]{32,40}$/i.test(o.signal) ||
      typeof o.accept !== 'boolean' ||
      typeof o.at !== 'number' ||
      !Number.isFinite(o.at)
    )
      return [];
    return [{ signalId: o.signal, accept: o.accept, atMs: o.at }];
  });
}

export function capacitorSignalActions(): SignalActionsProvider | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  const plugin = registerPlugin<SignalsPlugin>('FangpunktSignals');
  return {
    take: () =>
      plugin.takeAnswers().then(
        (r) => parseSignalAnswers(r.answers),
        () => [],
      ),
    onAnswer(listener) {
      let remove: (() => void) | undefined;
      let gone = false;
      void plugin
        .addListener('signalAnswer', listener)
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

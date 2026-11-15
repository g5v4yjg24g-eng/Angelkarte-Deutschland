// Holt die vorgemerkten Knopf-Aktionen der Live Activity ab (beim Start, wenn ein Knopf gedrückt wird und beim
// Zurückkehren in die App) und führt sie aus (pendingActions.ts). Nur in der iPhone-App; ohne Anbieter passiert nichts.
import { useEffect } from 'react';
import { useProviders } from '../../../ports/providersContext';
import { applyPendingActions } from './pendingActions';

export function LiveActionSync() {
  const { liveActivity, account } = useProviders();
  useEffect(() => {
    if (!liveActivity) return;
    let busy = Promise.resolve();
    const drain = () => {
      // nacheinander, damit sich schnelle Knopfdrücke nicht überholen
      busy = busy
        .then(async () => {
          const actions = await liveActivity.takeActions();
          if (actions.length)
            await applyPendingActions(
              actions,
              account.enabled ? (id) => account.endGroupSession(id) : undefined,
            );
        })
        .catch(() => undefined);
    };
    drain();
    const off = liveActivity.onAction(drain);
    const onVisible = () => document.visibilityState === 'visible' && drain();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [liveActivity, account]);
  return null;
}

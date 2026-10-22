import { useRegisterSW } from 'virtual:pwa-register/react';
import { de } from '../i18n/de';
import { Button } from '../design/components/Button';
import { Toast } from '../design/components/Toast';

/** Zeigt neue Versionen an; neu geladen wird erst nach Bestätigung (kein Datenverlust in offenen Formularen). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (needRefresh) {
    return (
      <Toast
        actions={
          <>
            <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
              {de.update.later}
            </Button>
            <Button onClick={() => void updateServiceWorker(true)}>{de.update.reload}</Button>
          </>
        }
      >
        {de.update.available}
      </Toast>
    );
  }
  if (offlineReady) {
    return (
      // Reine Info: blendet sich aus, damit sie auf dem Handy keine Bedienelemente verdeckt
      <Toast
        onDismiss={() => setOfflineReady(false)}
        actions={
          <Button variant="ghost" onClick={() => setOfflineReady(false)}>
            {de.common.close}
          </Button>
        }
      >
        {de.update.offlineReady}
      </Toast>
    );
  }
  return null;
}

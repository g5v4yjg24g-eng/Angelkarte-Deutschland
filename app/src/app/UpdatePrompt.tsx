import { useEffect } from 'react';
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

  // Reine Info: nach kurzer Zeit ausblenden, damit sie auf dem Handy keine Bedienelemente verdeckt
  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), 8000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

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
      <Toast
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

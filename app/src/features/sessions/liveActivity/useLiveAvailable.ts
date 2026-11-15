import { useEffect, useState } from 'react';
import { useProviders } from '../../../ports/providersContext';

/** Kann dieses Gerät Live Activities zeigen? Im Browser immer false (kein Anbieter), sonst einmal beim Öffnen gefragt. */
export function useLiveAvailable(): boolean {
  const { liveActivity } = useProviders();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!liveActivity) return;
    let live = true;
    void liveActivity.available().then((v) => live && setAvailable(v));
    return () => {
      live = false;
    };
  }, [liveActivity]);
  return available;
}

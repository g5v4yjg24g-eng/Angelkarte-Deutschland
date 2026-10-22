import { useEffect } from 'react';
import { useProviders } from '../../ports/providersContext';
import { fillMissingPlaces } from '../../data/waterPlaceService';

/** Fehlende Orte bekannter Gewässer einmal beim Öffnen des Fangbuchs nachtragen (Fehler sind still). */
export function useWaterPlaces() {
  const { water } = useProviders();
  useEffect(() => {
    void fillMissingPlaces(water).catch(() => undefined);
  }, [water]);
}

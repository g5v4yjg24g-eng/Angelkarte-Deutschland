// Lädt im Hintergrund fehlendes Wetter zu Fängen, solange die Einstellung an und das Gerät online ist.
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProviders } from '../../ports/providersContext';
import { useOnline } from '../../lib/useOnline';
import { fillMissingWeather, pendingWeatherIds } from '../../data/weatherService';
import { useWeatherEnabled } from './useWeatherEnabled';

export function WeatherSync() {
  const { weather } = useProviders();
  const online = useOnline();
  const enabled = useWeatherEnabled();
  // Ändert sich, sobald ein Fang Wetter braucht (neu, verschoben) oder welches bekommen hat.
  const pending = useLiveQuery(async () => (await pendingWeatherIds()).join(','), []);
  const running = useRef(false);
  const noData = useRef(new Set<string>());
  // Nach einem Lauf mit Ergebnissen erneut prüfen (Änderungen während des Laufs, mehr als ein Stapel).
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled || !online || !pending || running.current) return;
    running.current = true;
    void fillMissingWeather(weather, { skip: noData.current })
      .then((r) => {
        r.noData.forEach((id) => noData.current.add(id));
        running.current = false;
        if (r.filled.length && !r.error) setRound((n) => n + 1);
      })
      .catch(() => {
        running.current = false;
      });
  }, [enabled, online, pending, weather, round]);

  return null;
}

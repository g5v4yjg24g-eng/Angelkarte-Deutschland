// Lädt im Hintergrund den Pegel zum Fangzeitpunkt nach (wie WeatherSync), solange „Wetter am Fang“ an und das Gerät
// online ist. Es wird keine Position übertragen (siehe data/gaugeService.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProviders } from '../../ports/providersContext';
import { useOnline } from '../../lib/useOnline';
import { stateOfPosition, type StatesFile } from '../../domain/states';
import type { WaterDataProvider } from '../../ports/waterData';
import { fillMissingGauges, pendingGaugeIds, type GaugeSources } from '../../data/gaugeService';
import { useWeatherEnabled } from './useWeatherEnabled';

const RETRY_MS = 5 * 60_000;

/** Bundesland-Prüfung mit einmal geladenen Landesgrenzen; ein Fehlschlag wird nicht gemerkt. */
function gaugeSources(
  gauges: GaugeSources['gauges'],
  gaugesNrw: GaugeSources['gaugesNrw'],
  water: WaterDataProvider,
): GaugeSources {
  let states: Promise<StatesFile | null> | undefined;
  const load = () => {
    const p = water.loadManifest().then((m) => (m ? water.loadStates(m) : null));
    p.catch(() => {
      if (states === p) states = undefined;
    });
    return p;
  };
  return {
    gauges,
    gaugesNrw,
    async inNrw(pos) {
      const file = await (states ??= load());
      const r = file ? stateOfPosition(file, pos) : { kind: 'unknown' as const };
      return r.kind === 'state' ? r.code === 'NW' : r.kind === 'border' && r.codes.includes('NW');
    },
  };
}

export function GaugeSync() {
  const { gauges, gaugesNrw, water } = useProviders();
  const online = useOnline();
  const enabled = useWeatherEnabled();
  const pending = useLiveQuery(async () => (await pendingGaugeIds()).join(','), []);
  const running = useRef(false);
  const later = useRef(new Set<string>());
  /** Nach einem Netz-/Dienstfehler eine Weile Ruhe, statt bei jeder Änderung die ganze Liste neu zu laden */
  const failedAt = useRef(0);
  const [round, setRound] = useState(0);

  // Wieder online → sofort neu versuchen
  useEffect(() => {
    if (online) failedAt.current = 0;
  }, [online]);

  const sources = useMemo(() => gaugeSources(gauges, gaugesNrw, water), [gauges, gaugesNrw, water]);

  useEffect(() => {
    if (!enabled || !online || pending === undefined || running.current) return;
    if (Date.now() - failedAt.current < RETRY_MS) return;
    running.current = true;
    void fillMissingGauges(sources, { skip: later.current })
      .then((r) => {
        r.later.forEach((id) => later.current.add(id));
        running.current = false;
        if (r.error) failedAt.current = Date.now();
        else if (r.filled.length) setRound((n) => n + 1);
      })
      .catch(() => {
        running.current = false;
        failedAt.current = Date.now();
      });
  }, [enabled, online, pending, sources, round]);

  return null;
}

import { useEffect, useState } from 'react';
import { useProviders } from '../../ports/providersContext';
import { stateOfPosition } from '../../domain/states';
import { checkCatch, type LawCheck, type StateResolution } from '../../domain/regulationCheck';
import type { Catch, LatLng } from '../../domain/schemas';
import type { StateCode } from '../../domain/water';
import { useRegulation } from './useRegulation';

/** Bundesland am Fangort aus den Landesgrenzen; `fixed` (gewählt/gespeichert) hat Vorrang. undefined = lädt. */
export function useStateResolution(
  position: LatLng | undefined,
  fixed?: StateCode,
): StateResolution | undefined {
  const { water } = useProviders();
  const lat = position?.lat;
  const lng = position?.lng;
  const [res, setRes] = useState<{ key: string; r: StateResolution }>();
  const key = `${lat ?? ''},${lng ?? ''}`;
  useEffect(() => {
    if (fixed || lat === undefined || lng === undefined) return;
    let alive = true;
    void (async () => {
      const m = await water.loadManifest();
      const file = m ? await water.loadStates(m) : null;
      const r: StateResolution = file ? stateOfPosition(file, { lat, lng }) : { kind: 'unknown' };
      if (alive) setRes({ key: `${lat},${lng}`, r });
    })();
    return () => {
      alive = false;
    };
  }, [water, lat, lng, fixed]);
  if (fixed) return { kind: 'state', code: fixed };
  if (lat === undefined || lng === undefined) return { kind: 'unknown' };
  return res?.key === key ? res.r : undefined;
}

type Input = Pick<Catch, 'outcome' | 'speciesId' | 'at' | 'lengthCm' | 'lengthMethod' | 'released'>;

/** Rechts-Prüfung eines Eintrags; undefined = lädt noch. */
export function useLawCheck(input: Input, resolution: StateResolution | undefined): LawCheck | undefined {
  const code = resolution?.kind === 'state' ? resolution.code : undefined;
  const reg = useRegulation(code);
  if (!resolution) return undefined;
  if (code && !reg) return undefined;
  return checkCatch(input, resolution, reg?.kind === 'ok' ? reg.set : undefined);
}

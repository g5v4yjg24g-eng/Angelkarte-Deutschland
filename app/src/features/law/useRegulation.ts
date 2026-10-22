import { useEffect, useState } from 'react';
import { loadRegulation, type RegulationResult } from '../../data/regulations';
import { STATE_CODES, type StateCode } from '../../domain/water';

/** undefined = lädt noch */
export function useRegulation(code: StateCode | undefined, includeDraft = false) {
  const [result, setResult] = useState<{ code: StateCode; r: RegulationResult }>();
  useEffect(() => {
    if (!code) return;
    let alive = true;
    void loadRegulation(code, { includeDraft }).then((r) => alive && setResult({ code, r }));
    return () => {
      alive = false;
    };
  }, [code, includeDraft]);
  return result && result.code === code ? result.r : undefined;
}

/** Status aller Länder für die Übersicht; undefined = lädt noch */
export function useAllRegulations() {
  const [all, setAll] = useState<Record<StateCode, RegulationResult>>();
  useEffect(() => {
    let alive = true;
    void Promise.all(STATE_CODES.map(async (c) => [c, await loadRegulation(c)] as const)).then(
      (list) => alive && setAll(Object.fromEntries(list) as Record<StateCode, RegulationResult>),
    );
    return () => {
      alive = false;
    };
  }, []);
  return all;
}

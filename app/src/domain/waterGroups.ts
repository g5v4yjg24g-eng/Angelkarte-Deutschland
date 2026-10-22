// Fangbuch nach Gewässern (PLAN „Fangbuch nach Gewässern", Entscheidungen Nutzer 2026-10-22):
// - bekannte Gewässer: ein Reiter je Name + Ort (Flussabschnitte einer Gemeinde gehören zusammen), Name fest;
// - unbekannte (ohne Namen): Fangorte, die über eine Kette von höchstens 200 m verbunden sind, bilden einen Reiter;
//   ein eigener Name gilt nur im Fangbuch und steht an den Einträgen (`waterSnapshot.customName`).
import type { Catch } from './schemas';
import { segmentDistanceM } from './geo';

export const UNKNOWN_RADIUS_M = 200;

export interface WaterGroup {
  key: string;
  kind: 'known' | 'unknown';
  /** Name aus den Daten (bekannt) bzw. eigener Name (unbekannt, optional) */
  name?: string | undefined;
  place?: string | undefined;
  ids: string[];
  /** letzter Eintrag (ms) – Reiter sind danach sortiert */
  lastAt: number;
}

const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  segmentDistanceM(a.lng, a.lat, [b.lng, b.lat], [b.lng, b.lat]);

/** Häufigster Wert (bei Gleichstand der jüngste). */
function mostCommon(values: (string | undefined)[]): string | undefined {
  const n = new Map<string, number>();
  for (const v of values) if (v) n.set(v, (n.get(v) ?? 0) + 1);
  let best: string | undefined;
  for (const [v, c] of n) if (!best || c > (n.get(best) ?? 0)) best = v;
  return best;
}

export function groupByWater(catches: readonly Catch[]): WaterGroup[] {
  const live = [...catches].filter((c) => !c.deletedAt).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const known = new Map<string, Catch[]>();
  const unknown: Catch[] = [];
  for (const c of live) {
    const name = c.waterSnapshot?.name?.trim();
    if (name) {
      const key = `w:${name.toLocaleLowerCase('de-DE')}|${c.waterSnapshot?.place ?? ''}`;
      known.set(key, [...(known.get(key) ?? []), c]);
    } else unknown.push(c);
  }

  // Unbekannte: Verbund über ≤ 200 m (Union-Find); Einträge ohne Fangort bilden eine eigene Gruppe
  const withPos = unknown.filter((c) => c.position);
  const parent = withPos.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] as number)));
  for (let i = 0; i < withPos.length; i++)
    for (let j = i + 1; j < withPos.length; j++) {
      const a = withPos[i]?.position;
      const b = withPos[j]?.position;
      if (a && b && distM(a, b) <= UNKNOWN_RADIUS_M) parent[find(i)] = find(j);
    }
  const clusters = new Map<number, Catch[]>();
  withPos.forEach((c, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), c]));
  const noPos = unknown.filter((c) => !c.position);

  const groups: WaterGroup[] = [];
  for (const [key, list] of known)
    groups.push({
      key,
      kind: 'known',
      name: list[0]?.waterSnapshot?.name?.trim(),
      place: list[0]?.waterSnapshot?.place,
      ids: list.map((c) => c.id),
      lastAt: Date.parse(list[0]?.at ?? ''),
    });
  for (const list of [...clusters.values(), ...(noPos.length ? [noPos] : [])]) {
    // Schlüssel aus dem ältesten Eintrag: bleibt stabil, wenn neue Fänge dazukommen
    const oldest = list[list.length - 1];
    // Eigener Name: der zuletzt vergebene (jüngster Eintrag mit Namen)
    const name = list.find((c) => c.waterSnapshot?.customName)?.waterSnapshot?.customName;
    groups.push({
      key: `u:${oldest?.id ?? ''}`,
      kind: 'unknown',
      ...(name ? { name } : {}),
      ...(mostCommon(list.map((c) => c.waterSnapshot?.place))
        ? { place: mostCommon(list.map((c) => c.waterSnapshot?.place)) }
        : {}),
      ids: list.map((c) => c.id),
      lastAt: Date.parse(list[0]?.at ?? ''),
    });
  }
  return groups.sort((a, b) => b.lastAt - a.lastAt);
}

/** Gruppen, deren Name oder Ort zur Suche passt (Groß-/Kleinschreibung egal). */
export function searchGroups(
  groups: readonly WaterGroup[],
  query: string,
  unknownLabel: string,
): WaterGroup[] {
  const q = query.trim().toLocaleLowerCase('de-DE');
  if (!q) return [...groups];
  return groups.filter((g) =>
    [g.name ?? unknownLabel, g.place].some((s) => s?.toLocaleLowerCase('de-DE').includes(q)),
  );
}

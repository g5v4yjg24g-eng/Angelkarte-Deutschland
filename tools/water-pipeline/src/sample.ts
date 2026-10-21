// Stichprobe WAT-2 (TEST_PLAN §3): bekannte Gewässer über dieselbe Suchfunktion wie die App finden
// und das Bundesland des ersten Treffers prüfen.
// Aufruf: node --import tsx src/sample.ts <ausgabeordner der Pipeline>
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { search, shardKey, type SearchEntry } from '../../../app/src/domain/search.ts';

const dir = process.argv[2];
if (!dir) throw new Error('Ordner fehlt');

// Suchbegriff → zulässige Bundesländer der Lage (Flüsse und Kanäle durchqueren mehrere)
const SAMPLE: [string, string[]][] = [
  ['Bodensee', ['BW', 'BY']],
  ['Chiemsee', ['BY']],
  ['Müritz', ['MV']],
  ['Steinhuder Meer', ['NI']],
  ['Edersee', ['HE']],
  ['Großer Plöner See', ['SH']],
  ['Starnberger See', ['BY']],
  ['Ammersee', ['BY']],
  ['Schweriner See', ['MV']],
  ['Großer Müggelsee', ['BE']],
  ['Kemnader See', ['NW']],
  ['Baldeneysee', ['NW']],
  ['Möhnesee', ['NW']],
  ['De Wittsee', ['NW']],
  ['Hohendeicher See', ['HH']],
  ['Elbe', ['BY', 'SN', 'ST', 'BB', 'NI', 'MV', 'HH', 'SH']],
  ['Rhein', ['BW', 'RP', 'HE', 'NW']],
  ['Mittellandkanal', ['NW', 'NI', 'ST']],
  ['Dümmer', ['NI']],
  ['Senftenberger See', ['BB']],
];

const stateOf = new Map<string, string>();
for (const file of ['tiles-areas.geojsonseq', 'tiles-lines.geojsonseq']) {
  const rl = createInterface({ input: createReadStream(join(dir, file)), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const p = (JSON.parse(line) as { properties: { wid: string; s?: string } }).properties;
    if (p.s) stateOf.set(p.wid, p.s);
  }
}

let failed = 0;
for (const [query, states] of SAMPLE) {
  const shard = join(dir, 'search', `${shardKey(query)}.json`);
  const entries = JSON.parse(readFileSync(shard, 'utf8')) as SearchEntry[];
  const hit = search(entries, query, undefined, 5).find((r) => !r.isPlace);
  const state = hit?.wid ? stateOf.get(hit.wid) : undefined;
  const ok = !!hit && !!state && states.includes(state);
  if (!ok) failed++;
  console.log(
    `${ok ? 'ok    ' : 'FEHLER'} ${query.padEnd(20)} → ${hit ? `${hit.name} · ${hit.kind} · ${hit.context} · ${state ?? '?'} · ${hit.wid}` : 'kein Treffer'}`,
  );
}
console.log(`${SAMPLE.length - failed}/${SAMPLE.length} gefunden und im erwarteten Bundesland`);
process.exit(failed ? 1 : 0);

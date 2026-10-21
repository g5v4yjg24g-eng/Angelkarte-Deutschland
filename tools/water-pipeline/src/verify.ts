// Prüft die fertigen Kacheln gegen die Eingabe von tippecanoe (Schritt 5 von run.sh):
//  1. Jedes Objekt steht in den Kacheln der höchsten Zoomstufe.
//  2. Jedes Objekt in den Kacheln trägt genau die Eigenschaften seiner Eingabe.
//     (tippecanoe < 2.55 hat bei Hash-Kollisionen im String-Pool IDs zwischen Objekten vertauscht.)
// Aufruf: tippecanoe-decode -Z14 -z14 water.pmtiles | node --import tsx src/verify.ts <ordner>
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('Ordner fehlt');

/** Eigenschaften in fester Reihenfolge, damit Eingabe und Kachel vergleichbar sind. */
const signature = (p: Record<string, unknown>) =>
  JSON.stringify(Object.keys(p).sort().map((k) => [k, p[k]]));

// Ein Way kann zugleich Fläche und Linie sein; dann gibt es zwei gültige Signaturen je wid.
const expected = new Map<string, Set<string>>();
for (const file of ['tiles-areas.geojsonseq', 'tiles-lines.geojsonseq']) {
  const rl = createInterface({ input: createReadStream(join(dir, file)), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const p = (JSON.parse(line) as { properties: Record<string, unknown> }).properties;
    const wid = String(p.wid);
    let set = expected.get(wid);
    if (!set) expected.set(wid, (set = new Set()));
    set.add(signature(p));
  }
}

const seen = new Set<string>();
const mismatches: string[] = [];
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.startsWith('{ "type": "Feature",')) continue;
  const p = (JSON.parse(line) as { properties: Record<string, unknown> }).properties;
  const wid = String(p.wid);
  seen.add(wid);
  if (!expected.get(wid)?.has(signature(p))) mismatches.push(`${wid} ${JSON.stringify(p)}`);
}

const missing = [...expected.keys()].filter((w) => !seen.has(w));
console.log(`  erwartet: ${expected.size}  fehlend: ${missing.length}  abweichende Eigenschaften: ${mismatches.length}`);
if (missing.length || mismatches.length) {
  const report = join(dir, 'verify-errors.txt');
  writeFileSync(report, [...missing.map((w) => `fehlt ${w}`), ...mismatches.map((m) => `abweichend ${m}`)].join('\n') + '\n');
  console.error(`FEHLER: Kacheln stimmen nicht mit der Eingabe überein (Liste: ${report})`);
  process.exit(1);
}

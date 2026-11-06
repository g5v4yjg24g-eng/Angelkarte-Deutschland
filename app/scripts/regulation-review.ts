// Prüf-Erinnerung für die Rechtsdaten (Paket 9C): listet Länder, die in 30 Tagen als „möglicherweise veraltet“
// gelten oder es schon sind. Ausgabe als Markdown (leer = nichts fällig). Läuft wöchentlich im Workflow
// „Rechtsdaten prüfen“, der daraus ein Issue macht; ändert keine Daten.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RegulationSetSchema, reviewDue } from '../src/domain/regulations';

const dir = join(import.meta.dirname, '..', 'data', 'regulations');
const sets = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => RegulationSetSchema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const due = reviewDue(sets, Date.now());
if (due.length) {
  console.log('Diese Länder sollten erneut mit dem amtlichen Text abgeglichen werden:\n');
  for (const d of due)
    console.log(
      `- **${d.stateCode}** – zuletzt geprüft ${d.checkedAt}, ${d.overdue ? 'gilt seit' : 'gilt ab'} ${d.staleFrom} als „möglicherweise veraltet“ (\`app/data/regulations/${d.stateCode}.json\`)`,
    );
  console.log(
    '\nVorgehen: amtlichen Text abrufen, Regeln vergleichen, `checkedAt` und `checkedBy` aktualisieren, `pnpm validate:data`. Nichts ungeprüft übernehmen.',
  );
}

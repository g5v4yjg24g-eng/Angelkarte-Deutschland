// Gewässerkarten-Daten aus app/data/permits (Varianten A und B): klein, werden bei Bedarf als eigener Chunk geladen
// und vor der Anzeige gegen das Schema geprüft. Ungültige Dateien gelten als „keine Angaben".
import {
  AssociationFileSchema,
  WaterPermitListSchema,
  type AssociationFile,
  type WaterPermit,
} from '../domain/permits';

export interface PermitData {
  waters: WaterPermit[];
  associations: AssociationFile | undefined;
}

let cache: Promise<PermitData> | undefined;

export function loadPermitData(): Promise<PermitData> {
  cache ??= Promise.all([
    import('../../data/permits/waters.json').then((m) => m.default as unknown),
    import('../../data/permits/associations.json').then((m) => m.default as unknown),
  ]).then(
    ([w, a]) => {
      const waters = WaterPermitListSchema.safeParse(w);
      const associations = AssociationFileSchema.safeParse(a);
      return {
        waters: waters.success ? waters.data : [],
        associations: associations.success ? associations.data : undefined,
      };
    },
    () => {
      cache = undefined; // offline ohne Chunk: beim nächsten Öffnen erneut versuchen
      return { waters: [], associations: undefined };
    },
  );
  return cache;
}

// Landesgrenzen aus der Gewässer-Pipeline (states.json, © OpenStreetMap-Mitwirkende, ODbL): Bundesland am Fangort.
import { z } from 'zod';
import { stateAt, type StateHit } from './geo';
import { STATE_CODES, type StateCode } from './water';

const Coord = z.tuple([z.number(), z.number()]);
export const StatesFileSchema = z.object({
  format: z.literal('fangpunkt-states'),
  formatVersion: z.literal(1),
  dataDate: z.string(),
  toleranceM: z.number().positive(),
  marginM: z.number().positive(),
  states: z.array(
    z.object({
      code: z.enum(STATE_CODES),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      polygons: z.array(z.array(z.array(Coord))),
    }),
  ),
});
export type StatesFile = z.infer<typeof StatesFileSchema>;

/** Bundesland an der Position; in Grenznähe (Abstand aus der Datei) wird nicht geraten. */
export function stateOfPosition(file: StatesFile, pos: { lat: number; lng: number }): StateHit<StateCode> {
  return stateAt(pos.lng, pos.lat, file.states, file.marginM);
}

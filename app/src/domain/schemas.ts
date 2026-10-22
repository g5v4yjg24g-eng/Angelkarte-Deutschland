// Zod-Schemas aller gespeicherten Nutzerdaten (DATA_MODEL §5). Dasselbe Schema dient
// Datenbank-Schreibzugriffen, Import und (ab M5) Formularen.
import { z } from 'zod';
import { WeatherSnapshotSchema } from './weather';
import { pauseIssue } from './session';
import { STATE_CODES } from './water';

const isoDateTime = z.iso.datetime({ offset: true });
const id = z.string().min(1).max(100);
const text = (max: number) => z.string().max(max);

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const MetaSchema = z.object({
  id,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional(),
  rev: z.number().int().min(0),
});

/** Gewässerbezug. waterId folgt ab M4 (Pipeline); bis dahin ggf. nur der Name (z. B. aus der Alt-App). */
const WaterRefSchema = {
  waterId: id.optional(),
  waterSnapshot: z
    .object({
      name: text(200).optional(),
      centroid: LatLngSchema.optional(),
      /** Ort des Gewässers (Gemeinde, sonst Kreis) aus den Gewässerdaten */
      place: text(120).optional(),
      /** eigener Name für ein unbekanntes Gewässer – gilt nur im Fangbuch */
      customName: text(80).optional(),
    })
    .optional(),
};

/** Unveränderte Originaldaten aus einem Fremdformat, damit beim Import nichts verloren geht. */
const LegacySchema = z.object({ source: z.literal('angelkarte-v2'), raw: z.record(z.string(), z.unknown()) });

export const PlaceTypeSchema = z.enum(['spot', 'jetty', 'parking', 'access', 'hazard', 'other']);

export const PlaceSchema = MetaSchema.extend({
  type: PlaceTypeSchema,
  name: text(80).optional(),
  notes: text(2000).optional(),
  position: LatLngSchema.extend({
    accuracyM: z.number().min(0).optional(),
    source: z.enum(['map-tap', 'gps', 'import']),
  }),
  ...WaterRefSchema,
  photoIds: z.array(id).optional(),
});

export const CatchOutcomeSchema = z.enum(['caught', 'contact', 'missed_bite', 'observation']);
export const MethodSchema = z.enum([
  'spinning',
  'jigging',
  'dropshot',
  'bottom',
  'float',
  'feeder',
  'fly',
  'trolling',
  'other',
]);
export const BaitTypeSchema = z.enum([
  'softbait',
  'crankbait',
  'spinner',
  'spoon',
  'spinnerbait',
  'chatterbait',
  'jigspinner',
  'natural',
  'other',
]);
const Compass8 = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

export const BaitSchema = z.object({
  name: text(120).optional(),
  type: BaitTypeSchema.optional(),
  color: text(60).optional(),
  sizeCm: z.number().min(0).max(100).optional(),
  weightG: z.number().min(0).max(1000).optional(),
  hookSize: text(20).optional(),
});

export const ConditionsSchema = z.object({
  sky: z.enum(['sunny', 'cloudy', 'rain', 'mixed']).optional(),
  cloudCover: z.enum(['0-25', '25-50', '50-75', '75-100']).optional(),
  airTempC: z.number().min(-40).max(50).optional(),
  waterTempC: z.number().min(0).max(40).optional(),
  windBft: z.number().int().min(0).max(12).optional(),
  windDir: Compass8.optional(),
  pressureHpa: z.number().min(850).max(1100).optional(),
  pressureTrend: z.enum(['falling', 'steady', 'rising']).optional(),
  turbidity: z.enum(['clear', 'slightly_turbid', 'turbid']).optional(),
  waterPlants: z.enum(['none', 'few', 'many']).optional(),
});

export const CatchSchema = MetaSchema.extend({
  outcome: CatchOutcomeSchema,
  contactDetail: z.enum(['lost_on_hook_set', 'lost_in_fight', 'lost_at_landing']).optional(),
  contactIntensity: z.number().int().min(1).max(5).optional(),
  at: isoDateTime,
  tz: text(60),
  position: LatLngSchema.extend({
    accuracyM: z.number().min(0).optional(),
    source: z.enum(['map-tap', 'gps', 'place', 'import']),
  }).optional(),
  ...WaterRefSchema,
  placeId: id.optional(),
  sessionId: id.optional(),
  /** Bundesland des Fangorts (aus den Landesgrenzen oder vom Nutzer gewählt) für die Rechts-Warnung */
  stateCode: z.enum(STATE_CODES).optional(),
  speciesId: id.optional(),
  speciesCertainty: z.enum(['certain', 'likely', 'guess']).optional(),
  speciesSource: z.enum(['user', 'ai-suggestion']).optional(),
  lengthCm: z.number().gt(0).max(250).optional(),
  lengthMethod: z.enum(['measured', 'estimated']).optional(),
  weightG: z.number().gt(0).max(100000).optional(),
  weightMethod: z.enum(['weighed', 'estimated', 'calculated']).optional(),
  released: z.enum(['released', 'kept']).optional(),
  bait: BaitSchema.optional(),
  baitPresetId: id.optional(),
  method: MethodSchema.optional(),
  retrieve: text(120).optional(),
  depthFishedM: z.number().min(0).max(300).optional(),
  gear: text(300).optional(),
  conditions: ConditionsSchema.optional(),
  /** automatisch geholt, Modellwert (domain/weather.ts) */
  weather: WeatherSnapshotSchema.optional(),
  notes: text(4000).optional(),
  photoIds: z.array(id).optional(),
  legacy: LegacySchema.optional(),
})
  // Nur ein gelandeter Fisch kann gemessen oder gewogen sein (TEST_PLAN CAT-3).
  .refine((c) => c.outcome === 'caught' || (c.lengthMethod !== 'measured' && c.weightMethod !== 'weighed'), {
    message: 'Messwerte (gemessen/gewogen) gibt es nur bei einem gelandeten Fang.',
    path: ['outcome'],
  })
  .refine((c) => c.outcome === 'contact' || c.contactDetail === undefined, {
    message: 'Details zum Kontakt nur bei einem Fischkontakt.',
    path: ['contactDetail'],
  });

export const SessionSchema = MetaSchema.extend({
  startAt: isoDateTime,
  endAt: isoDateTime.optional(),
  tz: text(60),
  ...WaterRefSchema,
  title: text(120).optional(),
  notes: text(4000).optional(),
  /** Pausen (aktive Angelzeit); `to` fehlt nur bei der laufenden Pause einer laufenden Session */
  pauses: z.array(z.object({ from: isoDateTime, to: isoDateTime.optional() })).optional(),
  defaults: z.object({ method: MethodSchema.optional(), baitPresetId: id.optional() }).optional(),
  legacy: LegacySchema.optional(),
})
  .refine((s) => !s.endAt || Date.parse(s.endAt) >= Date.parse(s.startAt), {
    message: 'Das Ende einer Session liegt vor ihrem Beginn.',
    path: ['endAt'],
  })
  .refine((s) => pauseIssue(s) === undefined, {
    message: 'Pausen müssen innerhalb der Session liegen und dürfen sich nicht überschneiden.',
    path: ['pauses'],
  });

export const PhotoMetaSchema = MetaSchema.extend({
  mime: z.enum(['image/jpeg', 'image/webp', 'image/png']),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().min(0),
  ownerType: z.enum(['catch', 'place']),
  ownerId: id,
});
export const PhotoSchema = PhotoMetaSchema.extend({
  blob: z.instanceof(Blob),
  thumb: z.instanceof(Blob).optional(),
});

export const BaitPresetSchema = MetaSchema.extend({
  label: text(120).min(1),
  bait: BaitSchema,
  method: MethodSchema.optional(),
});

export type LatLng = z.infer<typeof LatLngSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type PlaceType = z.infer<typeof PlaceTypeSchema>;
export type Catch = z.infer<typeof CatchSchema>;
export type CatchOutcome = z.infer<typeof CatchOutcomeSchema>;
export type Method = z.infer<typeof MethodSchema>;
export type BaitType = z.infer<typeof BaitTypeSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Photo = z.infer<typeof PhotoSchema>;
export type PhotoMeta = z.infer<typeof PhotoMetaSchema>;
export type BaitPreset = z.infer<typeof BaitPresetSchema>;

/** Alle Entitäten mit eigener Tabelle; Reihenfolge = Import-Reihenfolge (Bezüge zuerst). */
export const ENTITY_SCHEMAS = {
  sessions: SessionSchema,
  places: PlaceSchema,
  baitPresets: BaitPresetSchema,
  catches: CatchSchema,
} as const;
export type EntityTable = keyof typeof ENTITY_SCHEMAS;
export interface EntityMap {
  sessions: Session;
  places: Place;
  baitPresets: BaitPreset;
  catches: Catch;
}

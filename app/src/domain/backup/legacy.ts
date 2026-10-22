// Import von Sicherungen der Alt-App „Angelkarte" (Export {app:'angelkarte', version:2, entries, sessions, places, plans}).
// Abbildung laut DATA_MODEL §8. Grundsatz: nichts verlieren – jedes Original bleibt unter legacy.raw erhalten.
import {
  CatchSchema,
  PlaceSchema,
  SessionSchema,
  TripSchema,
  type Catch,
  type Place,
  type Session,
  type Trip,
} from '../schemas';
import { speciesIdFromName } from '../species';
import { DEFAULT_TZ, localToZonedIso, toZonedIso } from '../time';
import type { InvalidRecord } from './parse';
import { newId as newUuid } from '../id';

type Raw = Record<string, unknown>;

export interface LegacyPhoto {
  id: string;
  ownerId: string;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: Uint8Array;
}

export interface LegacyResult {
  catches: Catch[];
  sessions: Session[];
  places: Place[];
  trips: Trip[];
  photos: LegacyPhoto[];
  invalid: InvalidRecord[];
  notes: string[];
}

export function isLegacyBackup(json: unknown): boolean {
  if (Array.isArray(json))
    return json.length > 0 && json.every((e) => isObj(e) && 'lat' in e && 'result' in e);
  return (
    isObj(json) &&
    Array.isArray(json.entries) &&
    (typeof json.app !== 'string' || json.app.startsWith('angelkarte'))
  );
}

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
const msToIso = (v: unknown) => {
  const n = num(v);
  return n !== undefined && n > 0 ? toZonedIso(n, DEFAULT_TZ) : undefined;
};
/** Entfernt undefined-Felder (exactOptionalPropertyTypes, kompakte Exporte). */
function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const OUTCOME: Record<string, Pick<Catch, 'outcome' | 'contactDetail'>> = {
  caught: { outcome: 'caught' },
  bite: { outcome: 'missed_bite' },
  lost_hooked: { outcome: 'contact', contactDetail: 'lost_on_hook_set' },
  lost_drill: { outcome: 'contact', contactDetail: 'lost_in_fight' },
  seen: { outcome: 'observation' },
};
// Alt-App mischte Methoden und Ködertypen in einer Liste.
const METHOD: Record<string, Pick<Catch, 'method'> & { baitType?: NonNullable<Catch['bait']>['type'] }> = {
  Spinnfischen: { method: 'spinning' },
  Jiggen: { method: 'jigging' },
  'Drop Shot': { method: 'dropshot' },
  Jigspinner: { method: 'jigging', baitType: 'jigspinner' },
  Chatterbait: { method: 'spinning', baitType: 'chatterbait' },
  Gummifisch: { method: undefined, baitType: 'softbait' },
  Wobbler: { method: 'spinning', baitType: 'crankbait' },
  Spinner: { method: 'spinning', baitType: 'spinner' },
  Blinker: { method: 'spinning', baitType: 'spoon' },
  'Andere Methode': { method: 'other' },
};
const SKY = { sonnig: 'sunny', bewölkt: 'cloudy', Regen: 'rain', wechselhaft: 'mixed' } as const;
const CLOUDS = { '0–25 %': '0-25', '25–50 %': '25-50', '50–75 %': '50-75', '75–100 %': '75-100' } as const;
const WIND = { N: 'N', NO: 'NE', O: 'E', SO: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' } as const;
const TURBIDITY = { klar: 'clear', 'leicht trüb': 'slightly_turbid', trüb: 'turbid' } as const;
const PLANTS = { keine: 'none', wenig: 'few', viel: 'many' } as const;
const TREND = { fallend: 'falling', stabil: 'steady', steigend: 'rising' } as const;
const pick = <M extends Record<string, string>>(m: M, v: unknown): M[keyof M] | undefined =>
  typeof v === 'string' && v in m ? m[v as keyof M] : undefined;

/** "data:image/jpeg;base64,…" → Bytes. */
export function decodeDataUrl(url: string): { mime: LegacyPhoto['mime']; bytes: Uint8Array } | undefined {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
  if (!m?.[1] || !m[2]) return undefined;
  const bin = atob(m[2].replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1] as LegacyPhoto['mime'], bytes };
}

function convertEntry(e: Raw, newId: () => string): { c: Catch; photo?: LegacyPhoto } {
  const id = str(e.id) ?? newId();
  const date = str(e.date),
    time = str(e.time);
  const at = date && time ? localToZonedIso(date, time) : msToIso(e.created);
  if (!at) throw new Error('Datum/Uhrzeit fehlt');
  const createdAt = msToIso(e.created) ?? at;
  const updatedAt = msToIso(e.updated) ?? createdAt;
  const res = OUTCOME[String(e.result)];
  if (!res) throw new Error(`Unbekanntes Ergebnis „${String(e.result)}"`);
  const lat = num(e.lat),
    lng = num(e.lng);
  if (lat === undefined || lng === undefined) throw new Error('Koordinaten fehlen');

  const speciesName = str(e.species);
  const speciesId =
    speciesName && speciesName !== 'Unbekannt'
      ? speciesName === 'Andere Fischart'
        ? 'other'
        : speciesIdFromName(speciesName)
      : undefined;
  const lenMeas = num(e.lenMeas),
    lenEst = num(e.lenEst);
  const m = METHOD[String(e.method)];
  const intensity = num(String(e.intensity ?? '').slice(0, 1));
  const bait = clean({
    name: str(e.bait),
    type: m?.baitType,
    color: str(e.color),
    weightG: num(e.baitWeight),
  });
  const conditions = clean({
    sky: pick(SKY, e.weather),
    cloudCover: pick(CLOUDS, e.clouds),
    airTempC: num(e.temp),
    waterTempC: num(e.waterTemp),
    windBft: num(e.wind),
    windDir: pick(WIND, e.windDir),
    pressureHpa: num(e.pressure),
    pressureTrend: pick(TREND, e.pressTrend),
    turbidity: pick(TURBIDITY, e.turbidity),
    waterPlants: pick(PLANTS, e.plants),
  });
  const notes = [
    str(e.notes),
    str(e.sizeNote) && `Größe: ${str(e.sizeNote)}`,
    speciesName && !speciesId && speciesName !== 'Unbekannt'
      ? `Fischart (Alt-App): ${speciesName}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  let photo: LegacyPhoto | undefined;
  const photoUrl = str(e.photo);
  if (photoUrl) {
    const d = decodeDataUrl(photoUrl);
    if (d) photo = { id: `${id}-photo`, ownerId: id, ...d };
  }
  // Rohdaten ohne das (große) Foto aufbewahren
  const { photo: _omit, ...raw } = e;
  void _omit;

  const c: Catch = clean({
    id,
    createdAt,
    updatedAt,
    rev: 0,
    ...res,
    contactIntensity: res.outcome === 'observation' ? undefined : intensity,
    at,
    tz: DEFAULT_TZ,
    position: { lat, lng, source: 'import' as const },
    waterSnapshot: str(e.lake) ? { name: str(e.lake) } : undefined,
    sessionId: str(e.sessionId),
    speciesId,
    speciesCertainty: speciesId ? (e.guess ? 'guess' : 'certain') : undefined,
    speciesSource: speciesId ? ('user' as const) : undefined,
    lengthCm: lenMeas ?? lenEst,
    lengthMethod: lenMeas !== undefined ? 'measured' : lenEst !== undefined ? 'estimated' : undefined,
    // Alt-App beschriftete das Gewicht als „geschätzt"
    weightG: num(e.weight),
    weightMethod: num(e.weight) !== undefined ? ('estimated' as const) : undefined,
    released: e.released === 'zurückgesetzt' ? 'released' : e.released === 'entnommen' ? 'kept' : undefined,
    bait: Object.keys(bait).length ? bait : undefined,
    method: m?.method,
    retrieve: str(e.retrieve),
    depthFishedM: num(e.depth),
    gear: str(e.gear),
    conditions: Object.keys(conditions).length ? conditions : undefined,
    notes: notes || undefined,
    photoIds: photo ? [photo.id] : undefined,
    legacy: { source: 'angelkarte-v2' as const, raw },
  } as Catch);
  // Bei Fehlbiss/Kontakt kann die Alt-App „gemessen" enthalten – das ist dann eine Schätzung.
  if (c.outcome !== 'caught' && c.lengthMethod === 'measured') c.lengthMethod = 'estimated';
  return photo ? { c, photo } : { c };
}

export function convertLegacy(json: unknown, newId: () => string = newUuid): LegacyResult {
  const out: LegacyResult = {
    catches: [],
    sessions: [],
    places: [],
    trips: [],
    photos: [],
    invalid: [],
    notes: [],
  };
  const root: Raw = Array.isArray(json) ? { entries: json } : isObj(json) ? json : {};
  const list = (k: string) => (Array.isArray(root[k]) ? (root[k] as unknown[]) : []);

  list('entries').forEach((e, index) => {
    try {
      if (!isObj(e)) throw new Error('Kein Objekt');
      const { c, photo } = convertEntry(e, newId);
      const r = CatchSchema.safeParse(c);
      if (!r.success)
        throw new Error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      out.catches.push(r.data);
      if (photo) out.photos.push(photo);
    } catch (err) {
      out.invalid.push({
        table: 'catches',
        index,
        id: isObj(e) ? str(e.id) : undefined,
        reason: (err as Error).message,
      });
    }
  });

  list('sessions').forEach((s, index) => {
    try {
      if (!isObj(s)) throw new Error('Kein Objekt');
      const startAt = msToIso(s.start);
      if (!startAt) throw new Error('Beginn fehlt');
      const session = clean({
        id: str(s.id) ?? newId(),
        createdAt: startAt,
        updatedAt: msToIso(s.end) ?? startAt,
        rev: 0,
        startAt,
        endAt: msToIso(s.end),
        tz: DEFAULT_TZ,
        waterSnapshot: str(s.lake) ? { name: str(s.lake) } : undefined,
        legacy: { source: 'angelkarte-v2' as const, raw: s },
      } as Session);
      const r = SessionSchema.safeParse(session);
      if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join('; '));
      out.sessions.push(r.data);
    } catch (err) {
      out.invalid.push({
        table: 'sessions',
        index,
        id: isObj(s) ? str(s.id) : undefined,
        reason: (err as Error).message,
      });
    }
  });

  list('places').forEach((p, index) => {
    try {
      if (!isObj(p)) throw new Error('Kein Objekt');
      const type = p.type === 'steg' ? 'jetty' : p.type === 'platz' ? 'spot' : undefined;
      if (!type) throw new Error(`Unbekannter Ortstyp „${String(p.type)}"`);
      const lat = num(p.lat),
        lng = num(p.lng);
      if (lat === undefined || lng === undefined) throw new Error('Koordinaten fehlen');
      const createdAt = msToIso(p.created) ?? toZonedIso(Date.now());
      const place = clean({
        id: str(p.id) ?? newId(),
        createdAt,
        updatedAt: msToIso(p.updated) ?? createdAt,
        rev: 0,
        type,
        name: str(p.name)?.slice(0, 80),
        notes: str(p.desc)?.slice(0, 2000),
        position: { lat, lng, source: 'import' as const },
      } as Place);
      const r = PlaceSchema.safeParse(place);
      if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join('; '));
      out.places.push(r.data);
    } catch (err) {
      out.invalid.push({
        table: 'places',
        index,
        id: isObj(p) ? str(p.id) : undefined,
        reason: (err as Error).message,
      });
    }
  });

  // Termine aus dem Angelkalender: Tag, Uhrzeit, Titel, Notiz und Gewässername. Abgesagte entfallen.
  // Ohne Koordinaten gibt es zu übernommenen Terminen kein Wetter, bis ein Gewässer gewählt wird.
  let cancelled = 0;
  list('plans').forEach((p, index) => {
    try {
      if (!isObj(p)) throw new Error('Kein Objekt');
      if (p.status === 'cancelled') return void cancelled++;
      const date = str(p.date);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tag fehlt');
      const time = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : undefined);
      const from = time(p.start);
      const end = time(p.end);
      const createdAt = msToIso(p.created) ?? localToZonedIso(date, from ?? '00:00');
      const lake = str(p.lake);
      const water = lake && lake !== 'other' ? lake : str(p.place);
      const trip = clean({
        id: str(p.id) ?? newId(),
        createdAt,
        updatedAt: msToIso(p.updated) ?? createdAt,
        rev: 0,
        date,
        from,
        // Über Mitternacht (Ende vor Beginn) kennt der Kalender nicht: dann ohne Ende
        to: end && (!from || end > from) ? end : undefined,
        tz: DEFAULT_TZ,
        waterSnapshot: water ? { name: water.slice(0, 200) } : undefined,
        title: str(p.title)?.slice(0, 120),
        notes: str(p.notes)?.slice(0, 2000),
        legacy: { source: 'angelkarte-v2' as const, raw: p },
      } as Trip);
      const r = TripSchema.safeParse(trip);
      if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join('; '));
      out.trips.push(r.data);
    } catch (err) {
      out.invalid.push({
        table: 'trips',
        index,
        id: isObj(p) ? str(p.id) : undefined,
        reason: (err as Error).message,
      });
    }
  });
  if (out.trips.length)
    out.notes.push(
      `${out.trips.length === 1 ? '1 Termin' : `${out.trips.length} Termine`} aus dem Angelkalender: ohne Koordinaten, für Wetter bitte ein Gewässer wählen.`,
    );
  if (cancelled)
    out.notes.push(
      `${cancelled === 1 ? '1 abgesagter Termin wird' : `${cancelled} abgesagte Termine werden`} nicht übernommen.`,
    );
  if (out.catches.some((c) => c.legacy?.raw.wx))
    out.notes.push(
      'Automatisch geladene Wetterdaten bleiben als Originaldaten erhalten, werden aber noch nicht angezeigt.',
    );
  if (out.catches.some((c) => c.waterSnapshot?.name))
    out.notes.push(
      'Gewässernamen werden übernommen; die Zuordnung zur Gewässerkarte folgt, sobald die Karte verfügbar ist.',
    );
  return out;
}

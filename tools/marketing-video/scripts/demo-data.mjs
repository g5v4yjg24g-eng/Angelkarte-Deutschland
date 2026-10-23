// Beispieldaten für die Aufnahmen: eine Fangpunkt-Sicherung (Format „fangpunkt-backup" v1) am
// Hohendeicher See (OSM-Relation 9075175, Position aus dem Suchindex der App). Die Einträge sind
// ausgedachte Beispiele und werden im Video als „Beispieldaten" gekennzeichnet. Deterministisch.
import { createHash } from 'node:crypto';

const WATER = {
  waterId: 'osm:r9075175',
  waterSnapshot: { name: 'Hohendeicher See', centroid: { lat: 53.440107, lng: 10.107563 } },
};
const TZ = 'Europe/Berlin';

// Einfacher deterministischer Zufall (mulberry32)
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261023);
const pick = (a) => a[Math.floor(rand() * a.length)];
const between = (a, b) => a + rand() * (b - a);

let n = 0;
const id = (p) => `demo-${p}-${String(++n).padStart(3, '0')}`;
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, '.000Z');
const meta = (at) => ({ id: '', createdAt: iso(at), updatedAt: iso(at), rev: 1 });

// Fangstellen nahe der Seemitte (auf dem Wasser, visuell in der App geprüft)
const near = (dLat, dLng) => ({
  lat: +(WATER.waterSnapshot.centroid.lat + dLat).toFixed(6),
  lng: +(WATER.waterSnapshot.centroid.lng + dLng).toFixed(6),
});
const SPOTS = [near(0.0012, -0.0021), near(-0.0009, 0.0016), near(-0.0021, 0.0004), near(-0.0015, -0.0012)];

// Arten mit Längenbereich (cm), Methode und Ködern; Hecht/Zander nur außerhalb der Hamburger Schonzeit (1.2.–31.5.)
const SPECIES = [
  { id: 'perch', len: [18, 38], method: 'dropshot', baits: [{ name: 'Gummifisch 7 cm', type: 'softbait', color: 'Motoroil' }, { name: 'Spinner Gr. 3', type: 'spinner', color: 'Silber' }], w: 4 },
  { id: 'pike', len: [52, 74], method: 'spinning', baits: [{ name: 'Wobbler 12 cm', type: 'crankbait', color: 'Hecht-Dekor' }, { name: 'Gummifisch 15 cm', type: 'softbait', color: 'Weiß' }], w: 3.5, notSpring: true },
  { id: 'zander', len: [46, 66], method: 'jigging', baits: [{ name: 'Gummifisch 10 cm', type: 'softbait', color: 'Chartreuse' }], w: 1.5, notSpring: true },
  { id: 'roach', len: [16, 28], method: 'float', baits: [{ name: 'Made', type: 'natural' }], w: 2 },
  { id: 'bream', len: [35, 55], method: 'feeder', baits: [{ name: 'Mais', type: 'natural' }], w: 1.5 },
  { id: 'tench', len: [30, 45], method: 'float', baits: [{ name: 'Tauwurm', type: 'natural' }], w: 1 },
  { id: 'carp', len: [55, 78], method: 'bottom', baits: [{ name: 'Boilie 20 mm', type: 'natural' }], w: 1 },
];
const weighted = () => {
  const sum = SPECIES.reduce((s, x) => s + x.w, 0);
  let r = rand() * sum;
  for (const s of SPECIES) if ((r -= s.w) < 0) return s;
  return SPECIES[0];
};
// Grobe Längen-Gewicht-Beziehung nur für die Beispiele (W = a·L³)
const weightOf = (sp, cm) => Math.round({ perch: 0.0125, pike: 0.0072, zander: 0.0075, roach: 0.011, bream: 0.0105, tench: 0.0135, carp: 0.0145 }[sp] * cm ** 3);

export function buildDemoData(now = new Date('2026-10-22T12:00:00Z')) {
  const catches = [], sessions = [], places = [];

  const place = (type, name, pos, at) => ({ ...meta(at), id: id('place'), type, name, position: { ...pos, source: 'map-tap' }, ...WATER });
  const t0 = new Date('2026-04-12T08:00:00Z');
  places.push(place('jetty', 'Steg Nordufer', near(0.0024, -0.0006), t0));
  places.push(place('spot', 'Schilfkante', near(-0.0019, 0.0024), t0));
  places.push(place('parking', 'Parkplatz Badestelle', near(0.0036, -0.0034), t0));

  // 16 Angeltage zwischen April und Oktober, morgens oder abends
  const days = [];
  for (let m = 3; m <= 9; m++) for (const d of [6, 19, 27]) days.push(new Date(Date.UTC(2026, m, d)));
  for (const day of days.filter(() => rand() < 0.95)) {
    const morning = rand() < 0.55;
    const start = new Date(day.getTime() + (morning ? 4.5 : 15.5) * 3600e3);
    const hours = between(2.5, 4.5);
    const end = new Date(start.getTime() + hours * 3600e3);
    if (end > now) continue;
    const s = { ...meta(start), id: id('session'), startAt: iso(start), endAt: iso(end), tz: TZ, ...WATER, title: morning ? 'Morgenrunde' : 'Abendansitz' };
    sessions.push(s);
    const count = 2 + Math.floor(rand() * 2.6);
    for (let i = 0; i < count; i++) {
      const at = new Date(start.getTime() + between(0.2, hours - 0.1) * 3600e3);
      at.setUTCSeconds(0, 0);
      const spring = at.getUTCMonth() <= 4;
      let sp = weighted();
      while (sp.notSpring && spring) sp = weighted();
      const outcome = rand() < 0.8 ? 'caught' : pick(['contact', 'missed_bite']);
      const bait = pick(sp.baits);
      const c = { ...meta(at), id: id('catch'), outcome, at: iso(at), tz: TZ, position: { ...pick(SPOTS), source: 'map-tap' }, ...WATER, sessionId: s.id, stateCode: 'HH', method: sp.method, bait };
      if (outcome === 'caught') {
        const len = Math.round(between(...sp.len));
        Object.assign(c, { speciesId: sp.id, speciesCertainty: 'certain', speciesSource: 'user', lengthCm: len, lengthMethod: 'measured', weightG: weightOf(sp.id, len), weightMethod: 'estimated', released: sp.id === 'pike' || sp.id === 'carp' || rand() < 0.6 ? 'released' : 'kept' });
      } else if (outcome === 'contact') {
        Object.assign(c, { speciesId: sp.id, speciesCertainty: 'guess', contactDetail: 'lost_in_fight' });
      }
      catches.push(c);
    }
  }
  return { catches, places, sessions, baitPresets: [], trips: [], photos: [] };
}

export function buildBackup(data, exportedAt = '2026-10-22T12:00:00.000Z') {
  const checksum = 'sha256:' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  return { format: 'fangpunkt-backup', formatVersion: 1, appVersion: 'demo', exportedAt, schemaVersion: 2, counts, photos: 'omitted', checksum, data };
}

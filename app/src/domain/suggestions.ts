// „Angler entdecken“ (Wunsch Nutzer 2026-11-13): Profilvorschläge zwischen den Beiträgen im Feed. Gerechnet wird nur auf
// dem Server (supabase/migrations/*_angler_suggestions.sql); hier steht, was die App damit macht: Antwort prüfen,
// Gründe und Erfolge für die Karte wählen, Karussells im Feed platzieren und die freiwilligen Angaben (grobe Region,
// Gewässer) für den Server vorbereiten. Rein, ohne Netz.
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';
import { FAMILIES, FIRST_KEY, TIERS, tierKey, type FamilyId, type Tier } from './achievements';
import type { Catch, Session } from './schemas';

// ---------------------------------------------------------------------------------------------------------
// Antwort des Servers
export interface Suggestion {
  userId: string;
  username: string;
  displayName: string;
  badges: Badge[];
  /** Personen, denen ich folge und die ihr/ihm folgen */
  commonFriends: number;
  /** ein gemeinsames Gewässer (Name aus der eigenen Liste) */
  sharedWater?: string | undefined;
  /** gleiche Region (Umkreis 100 km) – nie eine Entfernung */
  sameRegion: boolean;
  /** freigegebene Erfolgsstufen („catches:gold“ …); fehlt = nicht freigegeben */
  achievementKeys?: string[] | undefined;
}

const RowSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  badges: z.array(z.unknown()).nullable().optional(),
  common_friends: z.number().int().min(0).nullable().optional(),
  shared_water: z.string().nullable().optional(),
  same_region: z.boolean().nullable().optional(),
  achievement_keys: z.array(z.string()).nullable().optional(),
});

/** Antwort von suggest_anglers(); kaputte und doppelte Zeilen fallen weg, jede Person kommt nur einmal vor */
export function parseSuggestionRows(rows: readonly unknown[] | null | undefined): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const r of rows ?? []) {
    const p = RowSchema.safeParse(r);
    if (!p.success || seen.has(p.data.user_id)) continue;
    const d = p.data;
    seen.add(d.user_id);
    out.push({
      userId: d.user_id,
      username: d.username,
      displayName: d.display_name,
      badges: parseBadges((d.badges ?? []).map((badge) => ({ badge }))),
      commonFriends: d.common_friends ?? 0,
      ...(d.shared_water ? { sharedWater: d.shared_water } : {}),
      sameRegion: d.same_region === true,
      ...(d.achievement_keys ? { achievementKeys: d.achievement_keys } : {}),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Karte: Gründe und Erfolge
export type Reason =
  { kind: 'friends'; count: number } | { kind: 'water'; name: string } | { kind: 'region' };

/** Gründe in fester Reihenfolge (Kontakte, Gewässer, Region); höchstens zwei – der stärkste zuerst */
export function reasonsOf(s: Suggestion, limit = 2): Reason[] {
  const all: Reason[] = [];
  if (s.commonFriends > 0) all.push({ kind: 'friends', count: s.commonFriends });
  if (s.sharedWater) all.push({ kind: 'water', name: s.sharedWater });
  if (s.sameRegion) all.push({ kind: 'region' });
  return all.slice(0, limit);
}

export interface ShownAchievement {
  /** „first“ oder Familie */
  kind: FamilyId | 'first';
  tier: Tier | 'start';
}

/**
 * Bis zu drei Erfolge für die Karte: „Erster Fang“ und je Familie die höchste Stufe, die wertvollsten zuerst.
 * Nichts freigegeben oder nichts erreicht → leer (die Karte zeigt dann eine neutrale Zeile).
 */
export function topAchievements(keys: readonly string[] | undefined, limit = 3): ShownAchievement[] {
  if (!keys) return [];
  const have = new Set(keys);
  const best: ShownAchievement[] = FAMILIES.flatMap((f) => {
    const tier = [...TIERS].reverse().find((t) => have.has(tierKey(f.id, t)));
    return tier ? [{ kind: f.id, tier }] : [];
  });
  best.sort((a, b) => TIERS.indexOf(b.tier as Tier) - TIERS.indexOf(a.tier as Tier));
  if (have.has(FIRST_KEY)) best.push({ kind: 'first', tier: 'start' });
  return best.slice(0, limit);
}

// ---------------------------------------------------------------------------------------------------------
// Platzierung im Feed
/** erstes Karussell nach so vielen Beiträgen (4–6) */
export const FIRST_AFTER = 5;
/** weitere frühestens nach so vielen zusätzlichen Beiträgen */
export const NEXT_GAP = 12;
export const MAX_CAROUSELS = 2;
/** Profile je Karussell (höchstens) und mindestens, damit überhaupt eines erscheint */
export const PER_CAROUSEL = 10;
export const MIN_CARDS = 3;
/** so viele Vorschläge fragt die App je Sitzung ab (zwei Karussells ohne Doppelte) */
export const FETCH_COUNT = MAX_CAROUSELS * PER_CAROUSEL;

/**
 * Stellen im Feed, nach denen ein Karussell steht (Anzahl Beiträge davor); `carousels` = wie viele Karussells es
 * überhaupt zu füllen gibt (`splitCarousels`). Ein einmal gesetzter Platz ändert sich nie – so springt nichts, wenn
 * Beiträge nachgeladen werden. Das erste Karussell steht nach 5 Beiträgen, bei weniger am Ende der Liste; das zweite
 * 12 Beiträge nach dem ersten, nur wenn es schon so viele gibt.
 */
export function nextAnchors(current: readonly number[], postCount: number, carousels: number): number[] {
  const out = [...current];
  if (carousels < 1 || postCount < 1) return out;
  if (out.length === 0) out.push(Math.min(FIRST_AFTER, postCount));
  const last = out[out.length - 1] ?? 0;
  if (out.length < Math.min(MAX_CAROUSELS, carousels) && postCount > last + NEXT_GAP)
    out.push(last + NEXT_GAP);
  return out;
}

/** Vorschläge auf die Karussells verteilen: höchstens 10 je Karussell, keine Person doppelt */
export function splitCarousels<T extends { userId: string }>(list: readonly T[], count: number): T[][] {
  const seen = new Set<string>();
  const unique = list.filter((s) => (seen.has(s.userId) ? false : (seen.add(s.userId), true)));
  const out: T[][] = [];
  for (let i = 0; i < count; i += 1) {
    const part = unique.slice(i * PER_CAROUSEL, (i + 1) * PER_CAROUSEL);
    if (part.length < MIN_CARDS) break;
    out.push(part);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Freiwillige Angaben für den Server
/** Raster der groben Region in Grad (ca. 11 × 7 km) */
export const REGION_STEP = 0.1;

export interface RegionCell {
  lat: number;
  lng: number;
}

/**
 * Position auf den Mittelpunkt eines 0,1°-Rasters runden – schon auf dem Gerät, bevor etwas gesendet wird. Außerhalb von
 * Deutschland und seiner Umgebung (45–57° N, 4–17° O) → undefined (nichts wird gesendet).
 */
export function roundRegion(lat: number, lng: number): RegionCell | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < 45 || lat > 57 || lng < 4 || lng > 17) return undefined;
  const r = (v: number) => Math.round(Math.round(v / REGION_STEP) * REGION_STEP * 10) / 10;
  return { lat: r(lat), lng: r(lng) };
}

export const MAX_WATERS = 30;
const WATER_ID = /^osm:[wr]\d{1,15}$/;

export interface ShareWater {
  id: string;
  name: string;
}

/**
 * Gewässer, die für Vorschläge hochgeladen werden: nur aus Fängen und Sessions (nie aus Orten/Spots), nur mit echter
 * Gewässerkennung und dem Namen aus den Gewässerdaten – eigene Namen („customName“), Orte, Zeiten und Fänge nicht.
 * Das zuletzt genutzte zuerst, höchstens 30.
 */
export function sharedWaters(catches: readonly Catch[], sessions: readonly Session[]): ShareWater[] {
  const last = new Map<string, { name: string; at: number }>();
  const note = (
    id: string | undefined,
    name: string | undefined,
    iso: string,
    deletedAt: string | undefined,
  ) => {
    const n = name?.trim();
    if (deletedAt || !id || !WATER_ID.test(id) || !n || n.length > 120) return;
    const at = Date.parse(iso);
    if (Number.isNaN(at)) return;
    const prev = last.get(id);
    if (!prev || at > prev.at) last.set(id, { name: n, at });
  };
  for (const c of catches) note(c.waterId, c.waterSnapshot?.name, c.at, c.deletedAt);
  for (const s of sessions) note(s.waterId, s.waterSnapshot?.name, s.startAt, s.deletedAt);
  return [...last.entries()]
    .sort((a, b) => b[1].at - a[1].at || a[0].localeCompare(b[0]))
    .slice(0, MAX_WATERS)
    .map(([id, v]) => ({ id, name: v.name }));
}

/** Merker je Konto: welche Gewässerliste zuletzt hochgeladen wurde (spart Wiederholungen) */
export const watersKey = (userId: string, list: readonly ShareWater[]) =>
  `${userId}|${list.map((w) => `${w.id}=${w.name}`).join(',')}`;

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
export interface SuggestionPrefs {
  /** in Vorschlägen anderer auffindbar */
  discoverable: boolean;
  /** Gewässer für Vorschläge nutzen */
  watersOn: boolean;
  /** grobe Region geteilt */
  regionOn: boolean;
}
export const DEFAULT_PREFS: SuggestionPrefs = { discoverable: true, watersOn: true, regionOn: false };

const PrefsRowSchema = z.object({
  discoverable: z.boolean(),
  waters_on: z.boolean(),
  region_on: z.boolean(),
});
/** Antwort von my_suggestion_prefs(); unbrauchbar → Standard */
export function parsePrefs(rows: readonly unknown[] | null | undefined): SuggestionPrefs {
  const p = PrefsRowSchema.safeParse(rows?.[0]);
  return p.success
    ? { discoverable: p.data.discoverable, watersOn: p.data.waters_on, regionOn: p.data.region_on }
    : DEFAULT_PREFS;
}

// ---------------------------------------------------------------------------------------------------------
// Folgen aus dem Karussell
export type FollowState = 'none' | 'busy' | 'requested' | 'following' | 'error';

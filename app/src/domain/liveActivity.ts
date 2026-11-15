// Live Activity „Session“ (Wunsch Nutzer 2026-11-15): Was auf dem Sperrbildschirm und in der Dynamic Island steht, und
// wann die iPhone-App die Anzeige startet, aktualisiert oder beendet. Rein, ohne Netz und ohne Plugin.
import type { Catch, Session } from './schemas';
import { activeMs, openPause, sessionCatches, sessionTally } from './session';
import { speciesById } from './species';

export type LiveState = 'running' | 'paused' | 'ended';

export interface LivePayload {
  sessionId: string;
  state: LiveState;
  /** Gewässername oder „Angeltag“; leer = nicht zeigen */
  title: string;
  /** Zeitpunkt, ab dem die Angelzeit läuft (jetzt minus Angelzeit) – das System zählt von selbst weiter */
  timerStartMs: number;
  activeSeconds: number;
  catches: number;
  bites: number;
  /** Strecke in km (eine Nachkommastelle); fehlt ohne Route */
  distanceKm?: number | undefined;
  /** Nur nach dem Ende: größter Fisch, z. B. „Hecht 74 cm“ */
  biggest?: string | undefined;
}

/** So lange bleibt die Zusammenfassung nach dem Ende auf dem Sperrbildschirm */
export const KEEP_ENDED_SECONDS = 30 * 60;
export const FALLBACK_TITLE = 'Angeltag';

const stateOf = (s: Session): LiveState => (s.endAt ? 'ended' : openPause(s) ? 'paused' : 'running');

/** Größter gelandeter Fisch der Session mit Länge, z. B. „Hecht 74 cm“ */
export function biggestFish(catches: readonly Catch[]): string | undefined {
  let best: Catch | undefined;
  for (const c of catches)
    if (c.outcome === 'caught' && c.lengthCm !== undefined && (!best || c.lengthCm > (best.lengthCm ?? 0)))
      best = c;
  if (!best || best.lengthCm === undefined) return undefined;
  const cm = best.lengthCm.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const name = best.speciesId ? speciesById(best.speciesId)?.de : undefined;
  return name ? `${name} ${cm} cm` : `${cm} cm`;
}

/** Strecke für die Anzeige: unter 50 m oder ohne Route gar nichts, sonst auf 0,1 km gerundet */
export const distanceKmOf = (distanceM: number | undefined): number | undefined =>
  distanceM !== undefined && distanceM >= 50 ? Math.round(distanceM / 100) / 10 : undefined;

export function livePayload(
  session: Session,
  catches: readonly Catch[],
  distanceM: number | undefined,
  opts: { showTitle: boolean; nowMs: number },
): LivePayload {
  const state = stateOf(session);
  const mine = sessionCatches(session, catches).map((x) => x.item);
  const { caught, bites } = sessionTally(mine);
  const active = activeMs(session, opts.nowMs);
  const name = session.waterSnapshot?.customName ?? session.waterSnapshot?.name;
  return {
    sessionId: session.id,
    state,
    title: opts.showTitle ? name?.trim() || FALLBACK_TITLE : '',
    timerStartMs: opts.nowMs - active,
    activeSeconds: Math.max(0, Math.floor(active / 1000)),
    catches: caught,
    bites,
    distanceKm: distanceKmOf(distanceM),
    biggest: state === 'ended' ? biggestFish(mine) : undefined,
  };
}

/**
 * Schlüssel für „hat sich etwas geändert?“. Der Zeitpunkt des Zählers gehört nicht hinein (er ändert sich mit jeder
 * Berechnung um Millisekunden), wohl aber Pausen – sie bestimmen, ab wann die Zeit läuft.
 */
export function liveKey(p: LivePayload, session: Pick<Session, 'pauses'>): string {
  const last = session.pauses?.at(-1);
  return JSON.stringify([
    p.sessionId,
    p.state,
    p.title,
    p.catches,
    p.bites,
    p.distanceKm ?? null,
    p.biggest ?? null,
    session.pauses?.length ?? 0,
    last?.from ?? null,
    last?.to ?? null,
  ]);
}

/** Was die App zuletzt angezeigt hat */
export interface LiveMemory {
  sessionId?: string | undefined;
  key?: string | undefined;
  ended?: boolean | undefined;
}

export type LiveAction =
  | { kind: 'start' | 'update'; payload: LivePayload }
  | { kind: 'end'; sessionId: string; payload?: LivePayload | undefined; keepSeconds: number };

/**
 * Nächster Schritt. `payload` = aktueller Stand der Session, die angezeigt werden soll (laufend oder gerade beendet);
 * undefined = es gibt nichts anzuzeigen. Ausgeschaltet oder keine Session → eine laufende Anzeige wird sofort entfernt.
 */
export function nextLiveAction(
  memory: LiveMemory,
  payload: LivePayload | undefined,
  key: string | undefined,
  enabled: boolean,
): { action: LiveAction | undefined; memory: LiveMemory } {
  const shown = memory.sessionId;
  if (!enabled || !payload || !key) {
    return {
      action: shown ? { kind: 'end', sessionId: shown, keepSeconds: 0 } : undefined,
      memory: {},
    };
  }
  if (payload.state === 'ended') {
    // Zusammenfassung nur für eine Session, die wir gerade angezeigt haben – nie für alte, längst beendete
    if (shown !== payload.sessionId || memory.ended) return { action: undefined, memory };
    return {
      action: { kind: 'end', sessionId: payload.sessionId, payload, keepSeconds: KEEP_ENDED_SECONDS },
      memory: { sessionId: payload.sessionId, key, ended: true },
    };
  }
  if (shown !== payload.sessionId || memory.ended) {
    return { action: { kind: 'start', payload }, memory: { sessionId: payload.sessionId, key } };
  }
  if (memory.key !== key) {
    return { action: { kind: 'update', payload }, memory: { sessionId: payload.sessionId, key } };
  }
  return { action: undefined, memory };
}

// ---------------------------------------------------------------------------------------------------------
// Knöpfe ohne App-Öffnen (iOS 17, App Intents): die Aktionen kommen vorgemerkt mit Zeitpunkt aus dem Swift-Modul

export type PendingKind = 'pause' | 'resume' | 'end';
export interface PendingLiveAction {
  action: PendingKind;
  sessionId: string;
  /** Wann der Knopf gedrückt wurde (ms seit 1970) – so wird pausiert/beendet, auch wenn die App später dazukommt */
  atMs: number;
}

/** Älter als das sind sie nicht mehr sinnvoll (eine vergessene Aktion soll keine Session nachträglich beenden) */
export const PENDING_MAX_AGE_MS = 12 * 3600e3;

/** Antwort des Plugins prüfen: unbekannte Aktionen und kaputte Zeilen fallen weg, Reihenfolge nach Zeitpunkt */
export function parsePendingActions(raw: unknown): PendingLiveAction[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingLiveAction[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { action, sessionId, atMs } = r as Record<string, unknown>;
    if (action !== 'pause' && action !== 'resume' && action !== 'end') continue;
    if (typeof sessionId !== 'string' || !sessionId || typeof atMs !== 'number' || !Number.isFinite(atMs))
      continue;
    out.push({ action, sessionId, atMs });
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** Aktionen, die noch gelten: nicht zu alt und nicht aus der Zukunft (Uhr falsch gestellt) */
export const freshPendingActions = (list: readonly PendingLiveAction[], nowMs: number) =>
  list.filter((a) => nowMs - a.atMs <= PENDING_MAX_AGE_MS && a.atMs <= nowMs + 60_000);

// Amtliche Wetterwarnungen des DWD (Wunsch Nutzer 2026-10-22, Quelle Bright Sky freigegeben 2026-10-23).
// Rein: Antwort prüfen, aktive Warnungen für einen Zeitraum auswählen, nach Stufe sortieren.
// Felder laut Bright-Sky-OpenAPI [V: api.brightsky.dev/openapi.json, 2026-10-23].
import { z } from 'zod';
import { roundCoord } from './weather';

/** DWD-Stufen 1–4 [V: Beispielwarnung „level 2 of 4“ hat severity „moderate“, Abruf 2026-10-22] */
export const SEVERITIES = ['minor', 'moderate', 'severe', 'extreme'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const severityLevel = (s: Severity) => SEVERITIES.indexOf(s) + 1;

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)));
const text = z.string().max(4000);

export const AlertSchema = z.object({
  id: z.string(),
  severity: z.enum(SEVERITIES),
  event: text,
  headline: text,
  description: text.optional(),
  instruction: text.optional(),
  /** Beginn (onset, sonst effective) */
  from: iso,
  /** Ende; fehlt es, gilt die Warnung bis auf Widerruf */
  to: iso.optional(),
});
export type Alert = z.infer<typeof AlertSchema>;

export const AlertsSchema = z.object({
  fetchedAt: z.number(),
  lat: z.number(),
  lng: z.number(),
  /** Gemeinde der Warnzelle, z. B. „Stadt Nettetal“ */
  place: z.string().optional(),
  alerts: z.array(AlertSchema),
});
export type Alerts = z.infer<typeof AlertsSchema>;

export interface AlertsQuery {
  lat: number;
  lng: number;
}
/** Koordinaten verlassen das Gerät nur gerundet (≈ 100 m), wie beim Wetter. */
export const alertsQuery = (p: { lat: number; lng: number }): AlertsQuery => ({
  lat: roundCoord(p.lat),
  lng: roundCoord(p.lng),
});

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Bright-Sky-Antwort → Alerts. Test-Meldungen und Entwarnungen („allclear“) entfallen; null bei unbrauchbarer Antwort. */
export function parseBrightSkyAlerts(json: unknown, q: AlertsQuery, fetchedAt: number): Alerts | null {
  const j = json as { alerts?: unknown; location?: { name?: unknown } | null } | null;
  if (!j || !Array.isArray(j.alerts)) return null;
  const alerts: Alert[] = [];
  for (const raw of j.alerts as Record<string, unknown>[]) {
    if (!raw || raw.status === 'test' || raw.response_type === 'allclear') continue;
    const r = AlertSchema.safeParse({
      id: str(raw.alert_id) ?? String(raw.id ?? ''),
      severity: raw.severity,
      event: str(raw.event_de) ?? str(raw.event_en),
      headline: str(raw.headline_de) ?? str(raw.headline_en),
      description: str(raw.description_de),
      instruction: str(raw.instruction_de),
      from: str(raw.onset) ?? str(raw.effective),
      to: str(raw.expires),
    });
    if (r.success) alerts.push(r.data);
  }
  const place = str(j.location?.name);
  return { fetchedAt, lat: q.lat, lng: q.lng, ...(place ? { place } : {}), alerts };
}

/** Warnungen, die sich mit [from, to) überschneiden – höchste Stufe zuerst, dann nach Beginn. */
export function alertsBetween(a: readonly Alert[], from: number, to: number): Alert[] {
  return a
    .filter((x) => Date.parse(x.from) < to && (x.to === undefined || Date.parse(x.to) > from))
    .sort(
      (x, y) =>
        severityLevel(y.severity) - severityLevel(x.severity) || Date.parse(x.from) - Date.parse(y.from),
    );
}

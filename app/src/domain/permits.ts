// Gewässerkarte (Wunsch Nutzer 2026-10-25, Varianten A+B+C): Wo gibt es die Angelkarte für ein Gewässer?
// A: geprüfte Einträge je Gewässer (app/data/permits/waters.json) – nur ein Link auf die Seite des Vereins/Verbands,
//    kein übernommener Inhalt. B: Angelkarten-Seite der Landesverbände (associations.json) als Anlaufstelle.
// C: eigener Link des Nutzers (Tabelle waterLinks, bleibt auf dem Gerät). Nichts wird aus OSM abgeleitet.
import { z } from 'zod';
import { STATE_CODES, type StateCode } from './water';

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als JJJJ-MM-TT');
const HttpsUrl = z.url({ protocol: /^https$/ });

export const WaterPermitSchema = z.object({
  waterId: z.string().regex(/^osm:[wr]\d+$/),
  /** Name wie in den Gewässerdaten, nur zur Lesbarkeit der Datei */
  waterName: z.string().min(1),
  /** wer die Angelkarten ausgibt bzw. das Gewässer betreut, wie auf der Quelle genannt */
  issuer: z.string().min(1),
  /** Seite mit den Angaben zur Angelkarte */
  url: HttpsUrl,
  note: z.string().min(1).optional(),
  checkedAt: IsoDate,
  checkedBy: z.string().min(1),
});
export type WaterPermit = z.infer<typeof WaterPermitSchema>;

export const WaterPermitListSchema = z.array(WaterPermitSchema).superRefine((list, ctx) => {
  const seen = new Set<string>();
  list.forEach((p, i) => {
    if (seen.has(p.waterId)) ctx.addIssue({ code: 'custom', path: [i, 'waterId'], message: 'doppelt' });
    seen.add(p.waterId);
  });
});

export const AssociationSchema = z.object({
  state: z.enum(STATE_CODES),
  name: z.string().min(1),
  /** Seite des Verbands zu Angelkarten bzw. Verbandsgewässern */
  url: HttpsUrl,
  checkedAt: IsoDate,
});
export type Association = z.infer<typeof AssociationSchema>;

export const AssociationFileSchema = z.object({
  /** woher die Liste der Verbände stammt */
  source: z.object({ title: z.string().min(1), url: HttpsUrl, retrievedAt: IsoDate }),
  associations: z.array(AssociationSchema),
  /** Länder ohne geprüften Verband, mit Grund */
  open: z.array(z.object({ state: z.enum(STATE_CODES), reason: z.string().min(1) })),
});
export type AssociationFile = z.infer<typeof AssociationFileSchema>;

export const permitFor = (list: readonly WaterPermit[], waterId: string) =>
  list.find((p) => p.waterId === waterId);

export const associationsFor = (list: readonly Association[], state: StateCode | undefined) =>
  state ? list.filter((a) => a.state === state) : [];

/**
 * Eingabe des Nutzers als Link: ohne Schema wird https ergänzt; nur http(s), keine Leerzeichen, mit Punkt im Host.
 * Gibt undefined zurück, wenn es kein brauchbarer Link ist.
 */
export function normalizeUserUrl(input: string): string | undefined {
  const s = input.trim();
  if (!s || /\s/.test(s)) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    if (!u.hostname.includes('.') || u.username || u.password) return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

/** Kurzform für die Anzeige: Host ohne www. */
export const linkHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

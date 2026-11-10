// Community-Regeln mit Versionen (Wunsch Nutzer 2026-11-10): Fassung vom Server prüfen, Zustimmung vergleichen,
// Entwurf im Admin-Bereich prüfen. Rein (ohne React, DB oder Netz). Grenzen wie auf dem Server
// (*_community_rules.sql): 1–15 Regeln, je höchstens 500 Zeichen, Einleitung höchstens 500, Änderungsgrund Pflicht ≤ 300.
import { z } from 'zod';

export interface CommunityRules {
  version: number;
  intro: string;
  items: string[];
  /** Was hat sich geändert? (fehlt bei der ersten Fassung) */
  summary?: string | undefined;
  publishedAt: string;
}

export interface RulesVersion extends CommunityRules {
  publisherName?: string | undefined;
  /** Zustimmungen zu dieser Fassung */
  consents: number;
  /** Konten insgesamt (zum Vergleich) */
  accounts: number;
}

export const RULES_MAX_ITEMS = 15;
export const RULES_MAX_ITEM = 500;
export const RULES_MAX_INTRO = 500;
export const RULES_MAX_SUMMARY = 300;

const RulesRow = z.object({
  version: z.number().int().min(1),
  intro: z.string().min(1),
  items: z.array(z.string()).min(1),
  summary: z.string().nullable().optional(),
  published_at: z.string(),
});

const toRules = (d: z.infer<typeof RulesRow>): CommunityRules => ({
  version: d.version,
  intro: d.intro,
  items: d.items,
  ...(d.summary ? { summary: d.summary } : {}),
  publishedAt: d.published_at,
});

/** Aktuelle Fassung aus current_rules(); kaputt oder leer = undefined (die App nutzt dann ihre gespeicherte) */
export function parseCurrentRules(rows: readonly unknown[] | null | undefined): CommunityRules | undefined {
  const p = RulesRow.safeParse(rows?.[0]);
  return p.success ? toRules(p.data) : undefined;
}

/** Gespeicherte Fassung (Gerätespeicher, gleiche Form wie vom Server) */
export function parseStoredRules(raw: string | null): CommunityRules | undefined {
  if (!raw) return undefined;
  try {
    return parseCurrentRules([JSON.parse(raw) as unknown]);
  } catch {
    return undefined;
  }
}

export function storeRules(r: CommunityRules): string {
  return JSON.stringify({
    version: r.version,
    intro: r.intro,
    items: r.items,
    summary: r.summary ?? null,
    published_at: r.publishedAt,
  });
}

const HistoryRow = RulesRow.extend({
  publisher_name: z.string().nullable().optional(),
  consents: z.number().int().min(0),
  accounts: z.number().int().min(0),
});

export function parseRulesHistory(rows: readonly unknown[] | null | undefined): RulesVersion[] {
  const out: RulesVersion[] = [];
  for (const r of rows ?? []) {
    const p = HistoryRow.safeParse(r);
    if (!p.success) continue;
    out.push({
      ...toRules(p.data),
      ...(p.data.publisher_name ? { publisherName: p.data.publisher_name } : {}),
      consents: p.data.consents,
      accounts: p.data.accounts,
    });
  }
  return out.sort((a, b) => b.version - a.version);
}

/** Neuere von zwei Fassungen (z. B. Gerätespeicher gegen eingebaute) */
export const newerRules = (a: CommunityRules | undefined, b: CommunityRules): CommunityRules =>
  a && a.version > b.version ? a : b;

/** Muss zugestimmt werden? accepted = höchste zugestimmte Fassung (Gerät oder Server), fehlt = keine */
export const needsConsentFor = (accepted: number | undefined, current: number) =>
  !(accepted && accepted >= current);

export interface RulesDraft {
  intro: string;
  items: string[];
  summary: string;
}
export type RulesDraftIssue = 'empty' | 'tooMany' | 'tooLong' | 'noSummary' | 'unchanged';

/** Leere Regeln fallen weg, Leerraum am Rand wird entfernt (wie auf dem Server) */
export function cleanDraft(d: RulesDraft): RulesDraft {
  return {
    intro: d.intro.trim(),
    items: d.items.map((i) => i.trim()).filter(Boolean),
    summary: d.summary.trim(),
  };
}

/** Prüft einen Entwurf vor dem Veröffentlichen; `current` = aktuelle Fassung (unverändert = nicht veröffentlichen) */
export function draftIssue(d: RulesDraft, current?: CommunityRules): RulesDraftIssue | undefined {
  const c = cleanDraft(d);
  if (!c.intro || c.items.length === 0) return 'empty';
  if (c.items.length > RULES_MAX_ITEMS) return 'tooMany';
  if (c.intro.length > RULES_MAX_INTRO || c.items.some((i) => i.length > RULES_MAX_ITEM)) return 'tooLong';
  if (current && c.intro === current.intro && c.items.join('\n') === current.items.join('\n'))
    return 'unchanged';
  if (!c.summary) return 'noSummary';
  if (c.summary.length > RULES_MAX_SUMMARY) return 'tooLong';
  return undefined;
}

/** Regel verschieben (Pfeile im Editor); außerhalb der Liste bleibt alles, wie es ist */
export function moveItem(items: readonly string[], from: number, to: number): string[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x as string);
  return next;
}

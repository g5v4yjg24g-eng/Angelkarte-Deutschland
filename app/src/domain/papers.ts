// Angelpapiere im Wallet (Wunsch Nutzer 2026-11-16): Zustand, Sortierung, Erinnerungsplan und Formularlogik. Rein –
// ohne Datenbank und ohne Oberfläche. Daten sind Kalendertage (JJJJ-MM-TT) ohne Zeitzone, Erinnerungen um 9 Uhr Ortszeit.
import type { Paper, PaperKind } from './schemas';

/** Tage vor dem Ablauf, an denen erinnert wird; 0 = am Tag des Ablaufs */
export const REMIND_DAYS = [30, 14, 7, 1, 0] as const;
/** Ab so vielen Tagen vor dem Ablauf gilt ein Papier als „läuft bald ab“ */
export const SOON_DAYS = 30;
/** Uhrzeit der Erinnerung (Ortszeit) */
export const REMIND_HOUR = 9;
/** iOS merkt höchstens 64 Mitteilungen vor; ein paar Plätze bleiben frei */
export const MAX_PENDING_REMINDERS = 60;

export const PAPER_KINDS: readonly PaperKind[] = ['license', 'permit', 'membership', 'other'];

const DAY_MS = 86_400_000;
const parts = (d: string) => d.split('-').map(Number) as [number, number, number];
const utcDay = (d: string) => {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
};

/** Heutiger Kalendertag in Ortszeit */
export function localToday(now: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
}

/** Tage von `from` bis `to` (negativ, wenn `to` davor liegt) */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS);
}

export type PaperState =
  | { kind: 'unlimited' }
  | { kind: 'valid'; days: number }
  | { kind: 'soon'; days: number }
  | { kind: 'expired'; days: number }
  | { kind: 'notYet'; days: number };

/** `days` = Tage bis zum Ablauf (soon/valid; 0 = läuft heute ab), seit dem Ablauf (expired) bzw. bis zum Beginn (notYet) */
export function paperState(p: Pick<Paper, 'validFrom' | 'validUntil'>, today: string): PaperState {
  if (p.validFrom && p.validFrom > today) return { kind: 'notYet', days: daysBetween(today, p.validFrom) };
  if (!p.validUntil) return { kind: 'unlimited' };
  const left = daysBetween(today, p.validUntil);
  if (left < 0) return { kind: 'expired', days: -left };
  return left <= SOON_DAYS ? { kind: 'soon', days: left } : { kind: 'valid', days: left };
}

export const remindEnabled = (p: Pick<Paper, 'remind'>) => p.remind !== false;

const RANK: Record<PaperState['kind'], number> = { expired: 0, soon: 1, valid: 2, notYet: 3, unlimited: 4 };

/** Abgelaufene und bald ablaufende zuerst, dann nach Ablaufdatum; unbefristete zuletzt */
export function sortPapers<T extends Paper>(papers: readonly T[], today: string): T[] {
  return papers
    .filter((p) => !p.deletedAt)
    .map((p) => ({ p, s: paperState(p, today) }))
    .sort(
      (a, b) =>
        RANK[a.s.kind] - RANK[b.s.kind] ||
        (a.p.validUntil ?? '9999').localeCompare(b.p.validUntil ?? '9999') ||
        a.p.title.localeCompare(b.p.title, 'de'),
    )
    .map((x) => x.p);
}

/** Papiere, auf die man achten sollte: abgelaufen oder in den nächsten 30 Tagen ablaufend */
export function needAttention<T extends Paper>(papers: readonly T[], today: string): T[] {
  return papers.filter((p) => {
    if (p.deletedAt) return false;
    const k = paperState(p, today).kind;
    return k === 'expired' || k === 'soon';
  });
}

export interface Reminder {
  /** stabil je Papier und Vorlauf – ein neuer Plan ersetzt den alten */
  id: string;
  /** Zeitpunkt in ms */
  at: number;
  title: string;
  body: string;
  /** Gehört zu einem Papier bzw. Termin (mit Datum): „Nicht mehr erinnern“ am Gerät gilt für die ganze Gruppe */
  group?: string;
}

export interface ReminderTexts {
  title: (p: Paper) => string;
  body: (p: Paper, daysLeft: number) => string;
}

/**
 * Alle noch anstehenden Erinnerungen, früheste zuerst, höchstens `MAX_PENDING_REMINDERS`. Nur Papiere mit Ablaufdatum
 * und eingeschalteter Erinnerung; Zeitpunkte vor `nowMs` entfallen.
 */
export function reminderPlan(
  papers: readonly Paper[],
  nowMs: number,
  texts: ReminderTexts,
  max = MAX_PENDING_REMINDERS,
): Reminder[] {
  const out: Reminder[] = [];
  for (const p of papers) {
    if (p.deletedAt || !p.validUntil || !remindEnabled(p)) continue;
    const [y, m, d] = parts(p.validUntil);
    for (const before of REMIND_DAYS) {
      const at = new Date(y, m - 1, d - before, REMIND_HOUR, 0, 0, 0).getTime();
      if (at <= nowMs) continue;
      out.push({ id: `paper.${p.id}.${before}`, at, title: texts.title(p), body: texts.body(p, before), group: `paper.${p.id}:${p.validUntil}` });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).slice(0, max);
}

/** Beim Verlängern: neues Ablaufdatum setzen; zeigt es nicht nach vorn, ist es ungültig */
export function renewIssue(
  p: Pick<Paper, 'validUntil' | 'validFrom'>,
  until: string,
): 'invalid' | 'notLater' | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return 'invalid';
  if (p.validFrom && until < p.validFrom) return 'notLater';
  if (p.validUntil && until <= p.validUntil) return 'notLater';
  return undefined;
}

// ---- Formular -------------------------------------------------------------------------------------------------------

export interface PaperDraft {
  kind: PaperKind;
  title: string;
  issuer: string;
  number: string;
  validFrom: string;
  validUntil: string;
  /** unbefristet: kein Ablaufdatum (und keine Erinnerung) */
  unlimited: boolean;
  remind: boolean;
  notes: string;
}

export type PaperField = 'title' | 'validFrom' | 'validUntil';
export type PaperError = 'required' | 'dateOrder' | 'dateMissing';
export type PaperErrors = Partial<Record<PaperField, PaperError>>;

export const emptyPaperDraft = (kind: PaperKind = 'permit'): PaperDraft => ({
  kind,
  title: '',
  issuer: '',
  number: '',
  validFrom: '',
  validUntil: '',
  unlimited: kind === 'license',
  remind: true,
  notes: '',
});

export const paperDraftFrom = (p: Paper): PaperDraft => ({
  kind: p.kind,
  title: p.title,
  issuer: p.issuer ?? '',
  number: p.number ?? '',
  validFrom: p.validFrom ?? '',
  validUntil: p.validUntil ?? '',
  unlimited: !p.validUntil,
  remind: remindEnabled(p),
  notes: p.notes ?? '',
});

export type PaperFields = Pick<
  Paper,
  'kind' | 'title' | 'issuer' | 'number' | 'validFrom' | 'validUntil' | 'remind' | 'notes'
>;

/** Formular → Felder; bei Fehlern `fields` leer. Leere Angaben werden `undefined` (für die Datenbank: entfernen). */
export function paperDraftToFields(d: PaperDraft): { fields?: PaperFields; errors: PaperErrors } {
  const errors: PaperErrors = {};
  const title = d.title.trim();
  if (!title) errors.title = 'required';
  const from = d.validFrom.trim();
  const until = d.unlimited ? '' : d.validUntil.trim();
  if (!d.unlimited && !until) errors.validUntil = 'dateMissing';
  if (from && until && until < from) errors.validUntil = 'dateOrder';
  if (Object.keys(errors).length) return { errors };
  const opt = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    errors,
    fields: {
      kind: d.kind,
      title,
      issuer: opt(d.issuer),
      number: opt(d.number),
      validFrom: from || undefined,
      validUntil: until || undefined,
      remind: d.remind,
      notes: opt(d.notes),
    },
  };
}

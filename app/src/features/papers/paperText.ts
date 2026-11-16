// Texte und Töne für Angelpapiere (Anzeige); die Regeln selbst stehen in domain/papers.ts.
import { de } from '../../i18n/de';
import type { PaperState } from '../../domain/papers';

const t = de.papers;

/** 31.12.2026 */
export function formatDay(d: string): string {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, day).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function stateText(s: PaperState): string {
  switch (s.kind) {
    case 'unlimited':
      return t.state.unlimited;
    case 'valid':
      return t.state.valid(s.days);
    case 'soon':
      return t.state.soon(s.days);
    case 'expired':
      return t.state.expired(s.days);
    case 'notYet':
      return t.state.notYet(s.days);
  }
}

export type Tone = 'ok' | 'soon' | 'expired' | 'neutral';
export function stateTone(s: PaperState): Tone {
  if (s.kind === 'expired') return 'expired';
  if (s.kind === 'soon') return 'soon';
  if (s.kind === 'valid') return 'ok';
  return 'neutral';
}

import type { Catch } from '../../domain/schemas';
import { catchTitle } from '../catches/catchText';

const date = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });

/** „Fang · Hecht · 72 cm · Rursee · 21.10.2026" für Auswahl und Beitrag */
export function catchSummary(c: Catch): string {
  const water = c.waterSnapshot?.customName ?? c.waterSnapshot?.name;
  return [
    catchTitle(c),
    c.lengthCm ? `${c.lengthCm.toLocaleString('de-DE')} cm` : '',
    water ?? '',
    date(c.at),
  ]
    .filter(Boolean)
    .join(' · ');
}

import { de } from '../../i18n/de';
import type { MinSizeRule, MonthDay } from '../../domain/regulations';

const t = de.law;
const pad = (n: number) => String(n).padStart(2, '0');

/** 15.02. */
export const md = (d: MonthDay) => `${pad(d.day)}.${pad(d.month)}.`;

/** „ab 50 cm", „45–75 cm" oder „bis 75 cm" */
export const sizeText = (r: Pick<MinSizeRule, 'minCm' | 'maxCm'>) =>
  r.minCm !== undefined && r.maxCm !== undefined
    ? t.window(r.minCm, r.maxCm)
    : r.minCm !== undefined
      ? t.cm(r.minCm)
      : r.maxCm !== undefined
        ? t.maxOnly(r.maxCm)
        : '–';

// CSV für Tabellenprogramme (Excel/Numbers/LibreOffice mit deutscher Einstellung): Semikolon, CRLF, UTF-8 mit BOM,
// Zahlen mit Dezimalkomma. Rein, ohne Abhängigkeiten.

export type Cell = string | number | undefined;

/** Zahl mit Komma; höchstens `digits` Nachkommastellen, ohne Tausenderpunkte. */
export function decimal(n: number | undefined, digits = 2): string {
  if (n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits, useGrouping: false });
}

/**
 * Textzelle: Anführungszeichen verdoppeln, bei Trennzeichen/Umbruch einklammern. Beginnt ein Text mit = + - @ oder
 * einem Steuerzeichen, wird ein ' vorangestellt, damit Tabellenprogramme ihn nicht als Formel ausführen.
 */
export function cell(v: Cell): string {
  if (v === undefined) return '';
  if (typeof v === 'number') return decimal(v, 6);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const line = (r: readonly Cell[]) => r.map(cell).join(';');
  return '﻿' + [line(header), ...rows.map(line)].join('\r\n') + '\r\n';
}

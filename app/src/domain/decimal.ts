/** "12,5" → 12.5; leer → undefined; sonst NaN (Eingabefehler). */
export function parseDecimal(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return undefined;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

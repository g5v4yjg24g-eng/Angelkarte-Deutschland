// Zufällige IDs (UUID v4). crypto.randomUUID gibt es nur in sicheren Kontexten (HTTPS, localhost);
// getRandomValues dagegen überall – z. B. beim Test im Heimnetz über eine IP-Adresse.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40; // Version 4
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // Variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

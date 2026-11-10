// Bild der Session-Zusammenfassung (Paket 12): quadratische Karte mit Zahlen, im Fangpunkt-Design. Nur Zahlen und
// Datum – kein Ort, keine Route. Das fertige Bild läuft wie ein Foto durch processPhoto (JPEG, Vorschaubild).
import { processPhoto, type ProcessedPhoto } from '../../../lib/processPhoto';

const SIZE = 1080;
const BG = '#0f5c6e';
const BG2 = '#0a181d';
const ACCENT = '#5cc4d6';
const TEXT = '#ffffff';
const MUTED = '#b8d6dc';

export interface SummaryCardInput {
  title: string;
  date: string;
  rows: { label: string; value: string }[];
  footer: string;
}

export async function renderSummaryCard(input: SummaryCardInput): Promise<ProcessedPhoto> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  await document.fonts?.ready.catch(() => undefined);
  const ui = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'sans-serif';
  const display =
    getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'serif';

  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, BG);
  g.addColorStop(1, BG2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Seitenrand so, dass auch der 4:5-Rahmen der Beitragsseite (schneidet je 10 % links/rechts) nichts abschneidet
  const pad = 160;
  const padY = 100;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ACCENT;
  ctx.font = `600 40px ${ui}`;
  ctx.fillText(input.title.toUpperCase(), pad, padY + 40, SIZE - 2 * pad);
  ctx.fillStyle = TEXT;
  ctx.font = `600 68px ${display}`;
  ctx.fillText(input.date, pad, padY + 140, SIZE - 2 * pad);

  // Raster 2 Spalten
  const rows = input.rows.slice(0, 6);
  const top = padY + 240;
  const colW = (SIZE - 2 * pad) / 2;
  const rowH = 175;
  rows.forEach((r, i) => {
    const x = pad + (i % 2) * colW;
    const y = top + Math.floor(i / 2) * rowH;
    ctx.fillStyle = MUTED;
    ctx.font = `500 34px ${ui}`;
    ctx.fillText(r.label, x, y + 34, colW - 30);
    ctx.fillStyle = TEXT;
    ctx.font = `700 58px ${ui}`;
    ctx.fillText(r.value, x, y + 112, colW - 30);
  });

  ctx.fillStyle = ACCENT;
  ctx.fillRect(pad, SIZE - padY - 70, 80, 6);
  ctx.fillStyle = TEXT;
  ctx.font = `600 44px ${display}`;
  ctx.fillText(input.footer, pad, SIZE - padY);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Bild konnte nicht erstellt werden');
  return processPhoto(blob);
}

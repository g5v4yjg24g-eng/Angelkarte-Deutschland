// QR-Code aus video.config.json erzeugen (SVG + PNG 4096 px) und durch Dekodieren prüfen.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import QRCode from 'qrcode';
import { decodePng } from './decode.mjs';

const root = new URL('..', import.meta.url);
const { targetUrl } = JSON.parse(readFileSync(new URL('video.config.json', root), 'utf8'));
if (!/^https:\/\/[^/]+\.[^/]+/.test(targetUrl)) throw new Error(`Keine öffentliche https-URL: ${targetUrl}`);

const outDir = new URL('assets/qr/', root);
mkdirSync(outDir, { recursive: true });
// Stufe Q (25 % Fehlerkorrektur), 4 Module Ruhezone, reines Schwarz auf Weiß
const opts = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#000000', light: '#ffffff' } };

writeFileSync(new URL('fangpunkt-qr.svg', outDir), await QRCode.toString(targetUrl, { ...opts, type: 'svg' }));
await QRCode.toFile(new URL('fangpunkt-qr.png', outDir).pathname, targetUrl, { ...opts, width: 4096 });
// Modulmatrix für das Video: QrCode.tsx zeichnet jedes Modul als Rechteck mit ganzzahliger Pixelgröße
const { modules } = QRCode.create(targetUrl, { errorCorrectionLevel: opts.errorCorrectionLevel });
const rows = [];
for (let y = 0; y < modules.size; y++) rows.push([...Array(modules.size)].map((_, x) => (modules.get(x, y) ? '1' : '0')).join(''));
writeFileSync(new URL('fangpunkt-qr-matrix.json', outDir), JSON.stringify({ url: targetUrl, quietZone: opts.margin, rows }) + '\n');
console.log(`Matrix ${modules.size} × ${modules.size} Module`);

for (const f of ['fangpunkt-qr.png']) {
  const decoded = decodePng(new URL(f, outDir).pathname);
  if (decoded !== targetUrl) throw new Error(`${f}: dekodiert "${decoded}" ≠ "${targetUrl}"`);
  console.log(`✓ ${f} dekodiert zu ${decoded}`);
}

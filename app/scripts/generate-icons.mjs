// Erzeugt alle App-Icons aus dem Marken-Master (src/design/brand/fish.json).
// Aufruf: pnpm icons  → public/icons/*
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { iconSvg } from './brand.mjs';

const out = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(out, { recursive: true });

const png = (svg, size, file) =>
  sharp(Buffer.from(svg), { density: 72 * (size / 100) * 1.0 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out + file);

// Normale Icons: Figur groß; maskable: Figur in der 80-%-Sicherheitszone (Maskierung durch das System).
await png(iconSvg({ scale: 0.86 }), 192, 'icon-192.png');
await png(iconSvg({ scale: 0.86 }), 512, 'icon-512.png');
await png(iconSvg({ scale: 0.66 }), 512, 'icon-maskable-512.png');
await png(iconSvg({ scale: 0.8 }), 180, 'apple-touch-icon.png');
writeFileSync(out + 'favicon.svg', iconSvg({ size: 64, scale: 0.9, radius: 22 }));
console.log('Icons erzeugt in', out);

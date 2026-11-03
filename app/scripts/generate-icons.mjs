// Erzeugt alle App-Icons aus dem Marken-Master (src/design/brand/fish.json).
// Aufruf: pnpm icons  → public/icons/*
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { fish, iconSvg } from './brand.mjs';

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

// iPhone-App (IOS_PLAN.md): App-Symbol 1024 px ohne Transparenz (Apple rundet selbst ab) und Startbild.
const ios = fileURLToPath(new URL('../ios/App/App/Assets.xcassets/', import.meta.url));
await sharp(Buffer.from(iconSvg({ scale: 0.8 })), { density: 72 * 10.24 })
  .resize(1024, 1024)
  .flatten({ background: fish.colors.deep })
  .png({ compressionLevel: 9 })
  .toFile(ios + 'AppIcon.appiconset/AppIcon-512@2x.png');
// Startbild: Fisch klein in der Mitte auf der Markenfarbe (wird auf jede Bildschirmgröße zugeschnitten)
const splash = await sharp(Buffer.from(iconSvg({ scale: 0.22 })), { density: 72 * 27.32 })
  .resize(2732, 2732)
  .flatten({ background: fish.colors.deep })
  .png({ compressionLevel: 9 })
  .toBuffer();
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  writeFileSync(ios + 'Splash.imageset/' + f, splash);
console.log('Icons erzeugt in', out);

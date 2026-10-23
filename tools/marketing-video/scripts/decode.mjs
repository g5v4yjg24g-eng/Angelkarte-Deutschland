// QR-Code in einem PNG finden und dekodieren (jsQR). Liefert den Text oder null.
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

export function decodePng(path) {
  const png = PNG.sync.read(readFileSync(path));
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return code ? code.data : null;
}

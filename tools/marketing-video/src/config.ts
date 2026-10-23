// Zentrale Daten des Videos: Texte, URL, Sprecher, Zeiten. Texte und URL werden in video.config.json geändert.
import cfg from '../video.config.json';
import voiceDurations from '../assets/voiceover/voiceover.json';
import qr from '../assets/qr/fangpunkt-qr-matrix.json';
import fish from '../../../app/src/design/brand/fish.json';

export { cfg, qr, fish };
export const FPS = cfg.fps;
export const sec = (s: number) => Math.round(s * FPS);

export const voiceover = cfg.voiceover.map((v) => ({
  ...v,
  durationS: (voiceDurations as Record<string, number>)[v.id] ?? 3,
}));

/** Szenen in Sekunden (Gesamtlänge 42 s; der QR-Code steht ab 33 s unbewegt bis zum Ende). */
export const T = {
  hook: [0, 4.5],
  discover: [4.5, 11],
  features: [11, 23.5],
  story: [23.5, 30],
  outro: [30, 42],
  qrStill: 33,
  total: 42,
} as const;

/** Farben aus dem Designsystem „Tiefwasser" (app/src/design/tokens.css) und dem Marken-Master. */
export const C = {
  deep: '#0B2A33',
  primary: '#0F5C6E',
  ripple: '#5CC4D6',
  accent: '#F2994A',
  fish: '#E8F4F5',
  text: '#0E2229',
};
export const FONT_UI = "'Inter Variable', system-ui, sans-serif";
export const FONT_DISPLAY = "'Fraunces Variable', Georgia, serif";

/** Angelszene: Datei in assets/fishing-scenes/, Startpunkt im Clip (s) und waagerechter Bildausschnitt
 * für Hochformat (0 = linker Rand, 0.5 = Mitte, 1 = rechter Rand). null = Platzhalter. */
export interface Clip {
  file: string;
  startFrom?: number;
  focusX?: number;
  /** senkrechter Bildausschnitt für Querformat bei Hochformat-Clips (0 = oben, 1 = unten) */
  focusY?: number;
}
export const clips = cfg.clips as Record<'lake' | 'fight' | 'fish', Clip | null>;

import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import css from './tokens.css?raw';

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
}

const themes = { hell: block(':root {'), dunkel: block(":root[data-theme='dark'] {") };

// [Vordergrund, Hintergrund, Mindestkontrast] – 4.5 für Text, 3 für Fokus/Grafik
const PAIRS: [string, string, number][] = [
  ['color-text', 'color-bg', 4.5],
  ['color-text', 'color-surface', 4.5],
  ['color-text', 'color-surface-2', 4.5],
  ['color-text-muted', 'color-bg', 4.5],
  ['color-text-muted', 'color-surface', 4.5],
  ['color-text-muted', 'color-surface-2', 4.5],
  ['color-primary', 'color-surface', 4.5],
  ['color-primary', 'color-bg', 4.5],
  ['color-on-primary', 'color-primary', 4.5],
  ['color-on-primary', 'color-primary-hover', 4.5],
  ['color-on-accent', 'color-accent', 4.5],
  ['color-danger', 'color-surface', 4.5],
  ['color-on-danger', 'color-danger', 4.5],
  ['color-success', 'color-surface', 4.5],
  ['color-warning-text', 'color-warning-bg', 4.5],
  ['color-focus', 'color-bg', 3],
  ['color-focus', 'color-surface', 3],
];

describe('Design-Tokens: Kontrast WCAG AA', () => {
  it('dunkles Theme ist in beiden Blöcken identisch definiert', () => {
    const media = css.slice(css.indexOf(":root:not([data-theme='light'])"));
    const mediaBlock = Object.fromEntries(
      [...media.slice(0, media.indexOf('}')).matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    expect(mediaBlock).toEqual(themes.dunkel);
  });

  for (const [name, t] of Object.entries(themes)) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${name}: ${fg} auf ${bg} ≥ ${min}`, () => {
        const a = t[fg],
          b = t[bg];
        if (!a || !b) throw new Error(`Token fehlt: ${a ? bg : fg}`);
        expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

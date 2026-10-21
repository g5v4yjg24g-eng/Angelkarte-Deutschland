// Baut SVG-Markup aus dem Marken-Master src/design/brand/fish.json (für Icons und das Intro in index.html).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const fish = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/design/brand/fish.json', import.meta.url)), 'utf8'),
);

/** Fisch-Gruppe ohne Hintergrund. scale/dy positionieren die Figur im 100er-Raster. */
export function fishGroup({ scale = 1, dy = 0, withRipple = true, classes = false } = {}) {
  const c = fish.colors;
  const t = `translate(50 ${50 + dy}) scale(${scale}) translate(-50 -50)`;
  const cls = (name) => (classes ? ` class="${name}"` : '');
  return `<g transform="${t}">
  ${withRipple ? `<path${cls('fish-ripple')} d="${fish.ripple}" fill="none" stroke="${c.ripple}" stroke-width="3.2" stroke-linecap="round"/>` : ''}
  <g${cls('fish-body')}>
    <path${cls('fish-tail')} d="${fish.tail}" fill="${c.fish}" style="transform-origin:${fish.tailPivot[0]}px ${fish.tailPivot[1]}px"/>
    ${fish.fins.map((d) => `<path d="${d}" fill="${c.fish}"/>`).join('\n    ')}
    <path d="${fish.body}" fill="${c.fish}"/>
    <path d="${fish.gill}" fill="none" stroke="${c.deep}" stroke-width="2.6" stroke-linecap="round"/>
    <circle${cls('fish-eye')} cx="${fish.eye.cx}" cy="${fish.eye.cy}" r="${fish.eye.r}" fill="${c.eye}"/>
  </g>
</g>`;
}

/** Vollständiges Icon-SVG mit Hintergrund. radius = 0 für vollflächige PWA-Icons. */
export function iconSvg({ size = 512, scale = 0.86, radius = 0 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
<rect width="100" height="100" rx="${radius}" fill="${fish.colors.deep}"/>
${fishGroup({ scale, dy: -2 })}
</svg>`;
}

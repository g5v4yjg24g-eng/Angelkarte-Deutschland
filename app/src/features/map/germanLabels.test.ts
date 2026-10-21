import { describe, expect, it } from 'vitest';
import { germanTextFields } from './germanLabels';

describe('Deutsche Kartenbeschriftung', () => {
  it('ersetzt Namensfelder, lässt Hausnummern und Straßennummern in Ruhe', () => {
    const r = germanTextFields([
      {
        id: 'place',
        type: 'symbol',
        layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']] },
      },
      { id: 'water_name', type: 'symbol', layout: { 'text-field': '{name:latin}\n{name:nonlatin}' } },
      { id: 'housenumber', type: 'symbol', layout: { 'text-field': '{housenumber}' } },
      { id: 'shield', type: 'symbol', layout: { 'text-field': '{ref}' } },
      { id: 'fp-catches', type: 'symbol', layout: { 'icon-image': ['get', 'kind'] } },
      { id: 'water', type: 'fill' },
    ]);
    expect(r.map((x) => x.id)).toEqual(['place', 'water_name']);
    expect(r[0]?.textField).toEqual(['coalesce', ['get', 'name:de'], ['get', 'name']]);
  });
});

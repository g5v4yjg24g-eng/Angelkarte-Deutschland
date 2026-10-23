import { describe, expect, it } from 'vitest';
import { hygonStationsUrl, hygonValuesUrl } from './hygonNrw';

describe('Landespegel NRW (OpenHygon)', () => {
  it('lädt feste Dateien ohne jede Positionsangabe', () => {
    for (const u of [hygonStationsUrl(), hygonValuesUrl()]) {
      const url = new URL(u);
      expect(url.host).toBe('www.opengeodata.nrw.de');
      expect(url.search).toBe('');
    }
  });
});

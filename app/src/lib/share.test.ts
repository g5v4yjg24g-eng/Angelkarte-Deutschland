import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveFile } from './share';
import * as storage from './storage';

const nav = navigator as unknown as { share?: unknown; canShare?: unknown };

afterEach(() => {
  vi.restoreAllMocks();
  delete nav.share;
  delete nav.canShare;
});

describe('Dateien sichern (SHR-2)', () => {
  it('im Browser bleibt es beim Download', async () => {
    const dl = vi.spyOn(storage, 'downloadBlob').mockImplementation(() => undefined);
    nav.share = vi.fn();
    nav.canShare = () => true;
    expect(await saveFile(new Blob(['x']), 'a.csv', false)).toBe('downloaded');
    expect(dl).toHaveBeenCalledOnce();
    expect(nav.share).not.toHaveBeenCalled();
  });

  it('in der App über das Teilen-Menü; Abbrechen ist kein Fehler; ohne Teilen → Download', async () => {
    const dl = vi.spyOn(storage, 'downloadBlob').mockImplementation(() => undefined);
    const share = vi.fn().mockResolvedValue(undefined);
    nav.share = share;
    nav.canShare = () => true;
    expect(await saveFile(new Blob(['x'], { type: 'text/csv' }), 'a.csv', true)).toBe('shared');
    const arg = share.mock.calls[0]?.[0] as { files: File[] };
    expect(arg.files[0]?.name).toBe('a.csv');

    share.mockRejectedValueOnce(new DOMException('abgebrochen', 'AbortError'));
    expect(await saveFile(new Blob(['x']), 'a.csv', true)).toBe('cancelled');
    expect(dl).not.toHaveBeenCalled();

    share.mockRejectedValueOnce(new Error('kaputt'));
    expect(await saveFile(new Blob(['x']), 'a.csv', true)).toBe('downloaded');

    nav.canShare = () => false;
    expect(await saveFile(new Blob(['x']), 'a.csv', true)).toBe('downloaded');
    expect(dl).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from 'vitest';
import { dragOffset, shouldClose } from './sheetDrag';

describe('Kommentar-Fenster herunterziehen (PRF-7)', () => {
  it('schließt bei einem Viertel der Höhe oder bei schnellem Wisch, sonst nicht', () => {
    expect(shouldClose(200, 0.1, 700)).toBe(true);
    expect(shouldClose(100, 0.1, 700)).toBe(false);
    expect(shouldClose(40, 0.9, 700)).toBe(true);
    expect(shouldClose(20, 2, 700)).toBe(false);
    expect(shouldClose(-50, 2, 700)).toBe(false);
  });
  it('nach oben bleibt das Fenster am Rand', () => {
    expect(dragOffset(-30)).toBe(0);
    expect(dragOffset(42)).toBe(42);
  });
});

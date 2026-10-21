import { describe, expect, it } from 'vitest';
import { applyTheme, readTheme, THEME_KEY } from './theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

describe('Theme', () => {
  it('liest nur gültige Werte, sonst System', () => {
    expect(readTheme(memoryStorage({ [THEME_KEY]: 'dark' }))).toBe('dark');
    expect(readTheme(memoryStorage({ [THEME_KEY]: 'pink' }))).toBe('system');
    expect(readTheme(memoryStorage())).toBe('system');
  });

  it('übersteht einen werfenden Speicher', () => {
    const broken = {
      getItem: () => {
        throw new Error('blockiert');
      },
    };
    expect(readTheme(broken)).toBe('system');
  });

  it('setzt und entfernt data-theme und speichert die Wahl', () => {
    const root = document.createElement('html');
    const s = memoryStorage();
    applyTheme('dark', root, s);
    expect(root.dataset.theme).toBe('dark');
    expect(s.m.get(THEME_KEY)).toBe('dark');
    applyTheme('system', root, s);
    expect(root.dataset.theme).toBeUndefined();
    expect(s.m.has(THEME_KEY)).toBe(false);
  });
});

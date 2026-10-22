import { describe, expect, it, vi } from 'vitest';
import { installIosViewportFix } from './iosViewport';

function fakeWindow(standalone: boolean | undefined) {
  const listeners: Record<string, (() => void)[]> = {};
  const on = (type: string, fn: () => void) => void (listeners[type] = [...(listeners[type] ?? []), fn]);
  const frames: (() => void)[] = [];
  const style = { height: '' };
  const win = {
    navigator: standalone === undefined ? {} : { standalone },
    scrollTo: vi.fn(),
    requestAnimationFrame: (cb: () => void) => (frames.push(cb), 1),
    addEventListener: on,
    document: { documentElement: { style }, visibilityState: 'visible', addEventListener: on },
  };
  const fire = (type: string) => listeners[type]?.forEach((f) => f());
  return { win, fire, frames, style };
}

describe('iOS-Homescreen-App: Anzeigefläche beim Start neu berechnen lassen', () => {
  it('scrollt beim Start einmal 1 px und zurück und stellt die Höhe wieder her', () => {
    const f = fakeWindow(true);
    expect(installIosViewportFix(f.win as never)).toBe(true);
    f.fire('load');
    expect(f.win.scrollTo).toHaveBeenLastCalledWith(0, 1);
    expect(f.style.height).toBe('calc(100% + 1px)');
    f.frames.forEach((cb) => cb());
    expect(f.win.scrollTo).toHaveBeenLastCalledWith(0, 0);
    expect(f.style.height).toBe('');
    // auch bei Rückkehr in die App
    f.fire('visibilitychange');
    expect(f.win.scrollTo).toHaveBeenCalledTimes(3);
  });

  it('im Browser und auf anderen Geräten: nichts', () => {
    for (const s of [undefined, false]) {
      const f = fakeWindow(s);
      expect(installIosViewportFix(f.win as never)).toBe(false);
      f.fire('load');
      expect(f.win.scrollTo).not.toHaveBeenCalled();
    }
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Cb = (v: never) => void;
const listeners = new Map<string, Cb>();
const plugin = {
  permission: vi.fn(() => Promise.resolve({ status: 'granted' })),
  start: vi.fn(() => Promise.resolve({ state: 'granted' })),
  stop: vi.fn(() => Promise.resolve()),
  current: vi.fn(() => Promise.resolve({ lat: 51.3, lng: 6.2, acc: 12, t: 1000 })),
  addListener: vi.fn((event: string, cb: Cb) => {
    listeners.set(event, cb);
    return Promise.resolve({ remove: vi.fn(() => Promise.resolve()) });
  }),
};
let native = true;
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native },
  registerPlugin: () => plugin,
}));

const load = async () => {
  vi.resetModules();
  return (await import('./capacitorLocation')).capacitorLocation();
};
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('capacitorLocation (LOC-1)', () => {
  beforeEach(() => {
    native = true;
    listeners.clear();
    vi.clearAllMocks();
    plugin.start.mockImplementation(() => Promise.resolve({ state: 'granted' }));
  });

  it('gibt es nur in der iPhone-App', async () => {
    native = false;
    expect(await load()).toBeUndefined();
  });

  it('Erlaubnis wird ohne Nachfrage gelesen; Unbekanntes wird „unknown“', async () => {
    const loc = await load();
    expect(await loc?.permission()).toBe('granted');
    plugin.permission.mockResolvedValueOnce({ status: 'komisch' });
    expect(await loc?.permission()).toBe('unknown');
    plugin.permission.mockRejectedValueOnce(new Error('x'));
    expect(await loc?.permission()).toBe('unknown');
  });

  it('mehrere Zuhörer teilen eine Messung: Start beim ersten, Ende beim letzten', async () => {
    const loc = await load();
    const a = vi.fn();
    const b = vi.fn();
    const offA = loc?.watch({ highAccuracy: true }, a, vi.fn());
    const offB = loc?.watch({ highAccuracy: true }, b, vi.fn());
    await settle();
    expect(plugin.start).toHaveBeenCalledTimes(1);
    (listeners.get('position') as Cb)({ lat: 51.3, lng: 6.2, acc: 8, t: 5 } as never);
    expect(a).toHaveBeenCalledWith({ lat: 51.3, lng: 6.2, accuracy: 8, t: 5 });
    expect(b).toHaveBeenCalledTimes(1);
    offA?.();
    expect(plugin.stop).not.toHaveBeenCalled();
    offB?.();
    expect(plugin.stop).toHaveBeenCalledTimes(1);
  });

  it('verweigerte Erlaubnis und Fehler kommen als Fehler an', async () => {
    const loc = await load();
    plugin.start.mockResolvedValueOnce({ state: 'denied' });
    const onError = vi.fn();
    const first = loc?.watch({ highAccuracy: true }, vi.fn(), onError);
    await settle();
    expect(onError).toHaveBeenCalledWith('denied');
    first?.();
    const again = vi.fn();
    const off = loc?.watch({ highAccuracy: true }, vi.fn(), again);
    await settle();
    (listeners.get('error') as Cb)({ code: 'unavailable' } as never);
    expect(again).toHaveBeenCalledWith('unavailable');
    off?.();
  });

  it('einmaliger Standort: Erfolg und abgelehnte Erlaubnis', async () => {
    const loc = await load();
    expect(await loc?.current({ highAccuracy: false })).toEqual({
      lat: 51.3,
      lng: 6.2,
      accuracy: 12,
      t: 1000,
    });
    plugin.current.mockRejectedValueOnce(new Error('denied'));
    await expect(loc?.current({ highAccuracy: false })).rejects.toBe('denied');
    plugin.current.mockRejectedValueOnce(new Error('unavailable'));
    await expect(loc?.current({ highAccuracy: false })).rejects.toBe('unavailable');
  });

  it('einmaliger Standort: Zeitüberschreitung', async () => {
    const loc = await load();
    plugin.current.mockImplementationOnce(() => new Promise(() => undefined));
    await expect(loc?.current({ highAccuracy: false, timeoutMs: 20 })).rejects.toBe('timeout');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { goatCounter } from './goatCounter';

describe('GoatCounter-Adapter (USE-2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sendet nur den Bereichspfad, ohne Cookies und ohne Referrer', () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(''),
    );
    vi.stubGlobal('fetch', fetchMock);
    goatCounter('fangpunkt').pageview('/fangbuch/:id');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const u = new URL(String(url));
    expect(u.host).toBe('fangpunkt.goatcounter.com');
    expect(u.pathname).toBe('/count');
    expect([...u.searchParams.keys()].sort()).toEqual(['p', 'rnd']);
    expect(u.searchParams.get('p')).toBe('/fangbuch/:id');
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('ohne Code: ausgeschaltet, kein Abruf', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const c = goatCounter(undefined);
    expect(c.enabled).toBe(false);
    c.pageview('/');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

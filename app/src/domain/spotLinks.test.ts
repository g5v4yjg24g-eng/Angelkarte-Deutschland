import { describe, expect, it } from 'vitest';
import { parseSpotLinkRows, sharedByMe, sharedWithMe, spotLinkErrorKind, uploadsTo } from './spotLinks';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  partner_id: 'u-anna',
  partner_username: 'anna',
  partner_display_name: 'Anna',
  partner_badges: [],
  direction: 'outgoing',
  status: 'accepted',
  created_at: '2026-11-12T10:00:00Z',
  spots_from_partner: 3,
  spots_to_partner: 5,
  i_share: true,
  ...over,
});

describe('Spot-Verbindungen (SPOT-6)', () => {
  it('liest Zeilen, ergänzt Fehlendes und überspringt Kaputtes', () => {
    const list = parseSpotLinkRows([
      row(),
      row({ id: 'l2', spots_from_partner: null, i_share: null }),
      row({ id: 'kaputt', status: 'declined' }),
      { id: 'x' },
      null,
    ]);
    expect(list.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(list[0]).toMatchObject({ username: 'anna', spotsFromPartner: 3, spotsToPartner: 5, iShare: true });
    expect(list[1]).toMatchObject({ spotsFromPartner: 0, iShare: true });
    expect(parseSpotLinkRows(undefined)).toEqual([]);
  });

  it('Reiter: Angebote an mich nur links, meine offenen Angebote nur rechts, Verbindungen in beiden', () => {
    const list = parseSpotLinkRows([
      row({ id: 'a', status: 'accepted' }),
      row({ id: 'b', status: 'pending', direction: 'incoming' }),
      row({ id: 'c', status: 'pending', direction: 'outgoing' }),
    ]);
    expect(sharedWithMe(list).map((l) => l.id)).toEqual(['a', 'b']);
    expect(sharedByMe(list).map((l) => l.id)).toEqual(['a', 'c']);
  });

  it('hochgeladen wird nur zu angenommenen Verbindungen, denen ich zugestimmt habe', () => {
    const list = parseSpotLinkRows([
      row({ id: 'a' }),
      row({ id: 'b', i_share: false }),
      row({ id: 'c', status: 'pending', direction: 'incoming' }),
    ]);
    expect(uploadsTo(list).map((l) => l.id)).toEqual(['a']);
  });

  it('erkennt Fehlerarten des Servers', () => {
    expect(spotLinkErrorKind(new Error('declined_recently'))).toBe('declined_recently');
    expect(spotLinkErrorKind(new Error('x too_many y'))).toBe('too_many');
    expect(spotLinkErrorKind(new Error('boom'))).toBe('unknown');
    expect(spotLinkErrorKind(undefined)).toBe('unknown');
  });
});

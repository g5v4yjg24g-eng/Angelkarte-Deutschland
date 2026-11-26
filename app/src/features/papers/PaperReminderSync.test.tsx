import 'fake-indexeddb/auto';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, setDb } from '../../data/db';
import { repo } from '../../data/repository';
import { removePaper, savePaper } from '../../data/paperService';
import { ProvidersProvider } from '../../ports/providers';
import type { Providers } from '../../ports/providersContext';
import type { RemindersProvider, ReminderPermission } from '../../ports/reminders';
import { freshDb } from '../../test/dbTestUtils';
import { PaperReminderSync } from './PaperReminderSync';

const nextYear = () => `${new Date().getFullYear() + 1}-06-30`;
function fake(permission: ReminderPermission) {
  return {
    permission: vi.fn(() => Promise.resolve(permission)),
    request: vi.fn(() => Promise.resolve(true)),
    replaceAll: vi.fn<RemindersProvider['replaceAll']>(() => Promise.resolve()),
  } satisfies RemindersProvider;
}
const mount = (r: RemindersProvider | undefined) =>
  render(
    <ProvidersProvider value={{ reminders: r } as unknown as Providers}>
      <PaperReminderSync />
    </ProvidersProvider>,
  );

describe('PaperReminderSync (PAP-2)', () => {
  beforeEach(() => setDb(freshDb()));
  afterEach(() => setDb(undefined));

  it('plant Erinnerungen für Papiere mit Ablaufdatum und ersetzt sie bei Änderungen', async () => {
    const r = fake('granted');
    mount(r);
    await waitFor(() => expect(r.replaceAll).toHaveBeenCalledWith([])); // nichts zu erinnern
    const p = await savePaper({
      input: { kind: 'permit', title: 'Jahreskarte', validUntil: nextYear(), remind: true },
    });
    await waitFor(() => expect(r.replaceAll.mock.calls.at(-1)?.[0]).toHaveLength(5));
    const plan = r.replaceAll.mock.calls.at(-1)?.[0] ?? [];
    expect(plan[0]).toMatchObject({ id: `paper.${p.id}.30`, title: 'Jahreskarte: Ablauf' });
    expect(plan[4]?.body).toBe('Läuft heute ab.');
    await act(async () => {
      await removePaper(p.id);
    });
    await waitFor(() => expect(r.replaceAll.mock.calls.at(-1)?.[0]).toEqual([]));
  });

  it('ohne Erlaubnis oder ohne Anbieter wird nichts geplant', async () => {
    const denied = fake('denied');
    const view = mount(denied);
    await savePaper({ input: { kind: 'permit', title: 'X', validUntil: nextYear(), remind: true } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(denied.replaceAll).not.toHaveBeenCalled();
    view.unmount();
    expect(() => mount(undefined)).not.toThrow();
  });

  it('abgeschaltete Erinnerung plant nichts', async () => {
    const r = fake('granted');
    mount(r);
    await savePaper({ input: { kind: 'permit', title: 'Y', validUntil: nextYear(), remind: false } });
    await waitFor(() => expect(r.replaceAll).toHaveBeenCalled());
    expect(r.replaceAll.mock.calls.at(-1)?.[0]).toEqual([]);
  });

  it('plant auch Erinnerungen für Angeltermine, zusammen mit denen der Papiere', async () => {
    const r = fake('granted');
    mount(r);
    await waitFor(() => expect(r.replaceAll).toHaveBeenCalledWith([]));
    const year = new Date().getFullYear() + 1;
    const trip = await repo('trips', getDb()).create({
      date: `${year}-05-10`,
      from: '06:30',
      tz: 'Europe/Berlin',
      title: 'Hecht am See',
    });
    await waitFor(() => expect(r.replaceAll.mock.calls.at(-1)?.[0]).toHaveLength(1));
    expect(r.replaceAll.mock.calls.at(-1)?.[0][0]).toMatchObject({
      id: `trip.${trip.id}.soon`,
      title: 'Hecht am See',
      body: 'Es geht gleich los: 06:30 Uhr.',
    });
    await savePaper({ input: { kind: 'permit', title: 'Karte', validUntil: `${year}-12-31`, remind: true } });
    await waitFor(() => expect(r.replaceAll.mock.calls.at(-1)?.[0]).toHaveLength(6));
    const ids = (r.replaceAll.mock.calls.at(-1)?.[0] ?? []).map((x) => x.id);
    expect(ids[0]).toBe(`trip.${trip.id}.soon`); // früheste zuerst, beide Arten gemischt
    await repo('trips', getDb()).remove(trip.id);
    await waitFor(() => expect(r.replaceAll.mock.calls.at(-1)?.[0]).toHaveLength(5));
  });
});

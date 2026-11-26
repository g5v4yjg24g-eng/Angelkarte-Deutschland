// Hält die Erinnerungen auf dem Gerät aktuell (nur iPhone-App): bei jeder Änderung an den Papieren oder Angelterminen,
// beim Start und beim Zurückkehren in die App wird der Plan (domain/papers.ts, domain/tripReminders.ts) neu berechnet und
// ersetzt die geplanten Mitteilungen. Beide Arten gehen in EINEM Aufruf hinaus, weil ersetzen alles Vorherige löscht
// (und iOS höchstens 64 anstehende Mitteilungen zulässt). Ohne Erlaubnis passiert nichts. Rendert nichts.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { de } from '../../i18n/de';
import { getDb } from '../../data/db';
import { MAX_PENDING_REMINDERS, reminderPlan } from '../../domain/papers';
import { sessionCheckPlan } from '../../domain/sessionCheck';
import { normalizeOffsets, tripReminderPlan } from '../../domain/tripReminders';
import { useProviders } from '../../ports/providersContext';
import { getSetting } from '../../data/settings';
import { usePapers } from './usePapers';

export function PaperReminderSync() {
  const { reminders } = useProviders();
  const papers = usePapers();
  const trips = useLiveQuery(async () => (await getDb().trips.toArray()).filter((t) => !t.deletedAt), []);

  const offsets = useLiveQuery(async () => normalizeOffsets(await getSetting('tripReminders')), []);

  const sessions = useLiveQuery(
    async () => (await getDb().sessions.toArray()).filter((s) => !s.deletedAt && !s.endAt),
    [],
  );
  const check = useLiveQuery(async () => (await getSetting('sessionCheck')) ?? true, []);

  useEffect(() => {
    if (!reminders || !papers || !trips || !offsets || !sessions || check === undefined) return;
    let alive = true;
    const run = async () => {
      if ((await reminders.permission()) !== 'granted' || !alive) return;
      const now = Date.now();
      const paperPlan = reminderPlan(papers, now, {
        title: (p) => de.papers.reminderTitle(p.title),
        body: (_p, days) => de.papers.reminderBody(days),
      });
      const tripPlan = tripReminderPlan(trips, now, {
        title: (t) =>
          de.calendar.reminderTitle({
            title: t.title,
            water: t.waterSnapshot?.name ?? t.waterSnapshot?.customName,
          }),
        body: (t, kind) => {
          const from = t.from ?? '';
          if (kind === 'h1') return de.calendar.reminderSoon(from);
          if (kind === 'h3') return de.calendar.reminderHours(from, 3);
          if (kind === 'day') return de.calendar.reminderDay(from);
          return kind === 'evening' ? de.calendar.reminderEvening : de.calendar.reminderMorning;
        },
      }, offsets);
      const sessionPlan = check
        ? sessionCheckPlan(sessions, now, { title: de.sessions.checkTitle, body: (h) => de.sessions.checkBody(h) })
        : [];
      // zusammen höchstens so viele, wie iOS vormerkt: die frühesten zuerst
      const plan = [...paperPlan, ...tripPlan, ...sessionPlan].sort((a, b) => a.at - b.at).slice(0, MAX_PENDING_REMINDERS);
      await reminders.replaceAll(plan);
    };
    void run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reminders, papers, trips, offsets, sessions, check]);

  return null;
}

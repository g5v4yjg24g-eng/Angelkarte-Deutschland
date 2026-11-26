// Hält die Erinnerungen auf dem Gerät aktuell (nur iPhone-App): bei jeder Änderung an den Papieren oder Angelterminen,
// beim Start und beim Zurückkehren in die App wird der Plan (domain/papers.ts, domain/tripReminders.ts) neu berechnet und
// ersetzt die geplanten Mitteilungen. Beide Arten gehen in EINEM Aufruf hinaus, weil ersetzen alles Vorherige löscht
// (und iOS höchstens 64 anstehende Mitteilungen zulässt). Ohne Erlaubnis passiert nichts. Rendert nichts.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { de } from '../../i18n/de';
import { getDb } from '../../data/db';
import { MAX_PENDING_REMINDERS, reminderPlan } from '../../domain/papers';
import { tripReminderPlan } from '../../domain/tripReminders';
import { useProviders } from '../../ports/providersContext';
import { usePapers } from './usePapers';

export function PaperReminderSync() {
  const { reminders } = useProviders();
  const papers = usePapers();
  const trips = useLiveQuery(async () => (await getDb().trips.toArray()).filter((t) => !t.deletedAt), []);

  useEffect(() => {
    if (!reminders || !papers || !trips) return;
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
        body: (t, kind) =>
          kind === 'soon' ? de.calendar.reminderSoon(t.from ?? '') : de.calendar.reminderEvening,
      });
      // zusammen höchstens so viele, wie iOS vormerkt: die frühesten zuerst
      const plan = [...paperPlan, ...tripPlan].sort((a, b) => a.at - b.at).slice(0, MAX_PENDING_REMINDERS);
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
  }, [reminders, papers, trips]);

  return null;
}

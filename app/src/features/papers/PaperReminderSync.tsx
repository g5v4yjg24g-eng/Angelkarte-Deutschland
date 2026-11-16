// Hält die Erinnerungen auf dem Gerät aktuell (nur iPhone-App): bei jeder Änderung an den Papieren, beim Start und beim
// Zurückkehren in die App wird der Plan (domain/papers.ts) neu berechnet und ersetzt die geplanten Mitteilungen.
// Ohne Erlaubnis für Mitteilungen passiert nichts. Rendert nichts.
import { useEffect } from 'react';
import { de } from '../../i18n/de';
import { reminderPlan } from '../../domain/papers';
import { useProviders } from '../../ports/providersContext';
import { usePapers } from './usePapers';

export function PaperReminderSync() {
  const { reminders } = useProviders();
  const papers = usePapers();

  useEffect(() => {
    if (!reminders || !papers) return;
    let alive = true;
    const run = async () => {
      if ((await reminders.permission()) !== 'granted' || !alive) return;
      const plan = reminderPlan(papers, Date.now(), {
        title: (p) => de.papers.reminderTitle(p.title),
        body: (_p, days) => de.papers.reminderBody(days),
      });
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
  }, [reminders, papers]);

  return null;
}

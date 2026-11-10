// Session-Zusammenfassung für einen Beitrag erstellen (Paket 12): Kennzahlen aus dem Rückblick, Bild ohne Ort.
import { de } from '../../../i18n/de';
import { getDb } from '../../../data/db';
import { getTrack } from '../../../data/trackService';
import { formatDuration } from '../../../domain/session';
import { sessionShareFacts } from '../../../domain/sessionShare';
import { buildReview, reviewEvents } from '../../../domain/sessionReview';
import { speciesById } from '../../../domain/species';
import type { ProcessedPhoto } from '../../../lib/processPhoto';
import { renderSummaryCard } from './summaryCard';

const t = de.sessionShare;
const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });

export interface SessionSummary {
  photo: ProcessedPhoto;
  caption: string;
  groupId?: string | undefined;
}

/** null = Session gibt es nicht (oder gelöscht) */
export async function createSessionSummary(
  sessionId: string,
  nowMs = Date.now(),
): Promise<SessionSummary | null> {
  const db = getDb();
  const session = await db.sessions.get(sessionId);
  if (!session || session.deletedAt) return null;
  const [catches, track] = await Promise.all([db.catches.toArray(), getTrack(sessionId)]);
  const review = buildReview(session, reviewEvents(session, catches), track, catches, nowMs);
  const f = sessionShareFacts(review);
  const rows = [
    { label: t.activeTime, value: formatDuration(f.activeMs) },
    { label: t.caught, value: f.caught.toLocaleString('de-DE') },
    { label: t.bites, value: f.bites.toLocaleString('de-DE') },
    { label: t.species, value: f.speciesCount.toLocaleString('de-DE') },
    ...(f.longest
      ? [
          {
            label: speciesById(f.longest.speciesId)?.de ?? t.longest,
            value: t.cm(f.longest.lengthCm, f.longest.estimated),
          },
        ]
      : []),
    ...(f.distanceKm !== undefined ? [{ label: t.distance, value: t.km(f.distanceKm) }] : []),
  ];
  const date = dateOf(session.startAt);
  const photo = await renderSummaryCard({ title: t.cardTitle, date, rows, footer: t.footer });
  return { photo, caption: t.caption(date), groupId: session.groupId };
}

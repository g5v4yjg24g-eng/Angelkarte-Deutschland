// Gemeinsame Session im Rückblick (Vorlage Nutzer 2026-11-11): Teilnehmer, „Highlights im Vergleich“, „Session
// gesamt“ und Session-Highlights – alles aus den Kennzahlen, die jede Person selbst hochgeladen hat. Keine Route
// und keine Einträge der anderen; wer noch nichts geteilt hat, steht mit „–“ da (nichts wird erfunden).
import { de } from '../../../i18n/de';
import { initialOf } from '../../../domain/feed';
import { groupTotals, leaders, type GroupStatsEntry } from '../../../domain/groupStats';
import { formatDuration } from '../../../domain/session';
import { speciesById } from '../../../domain/species';
import { Avatar } from '../../profile/Avatar';
import { useAvatarUrls } from '../../profile/avatarUrls';
import { useProfile } from '../../profile/usePhoto';
import type { GroupStatsState } from './useGroupStats';
import styles from './Review.module.css';

const t = de.review;
const g = de.review.together;

export function ReviewTogether({ state, durationMs }: { state: GroupStatsState; durationMs: number }) {
  const { me, members, stats } = state;
  const myProfile = useProfile();
  const avatars = useAvatarUrls(members.map((m) => m.userId));
  const byUser = new Map(stats.map((s) => [s.userId, s]));
  const people = members.map((m) => ({
    member: m,
    isMe: m.userId === me,
    name: m.userId === me ? g.you : m.displayName,
    stats: byUser.get(m.userId),
  }));
  const withStats = people.flatMap((p) => (p.stats ? [p.stats] : []));
  const lead = leaders(withStats);
  const totals = groupTotals(withStats);
  const nameOf = (userId: string | undefined) =>
    people.find((p) => p.member.userId === userId)?.member.displayName;
  const missing = people.filter((p) => !p.stats && !p.isMe).map((p) => p.member.displayName);

  const avatarOf = (p: (typeof people)[number], size: number) =>
    p.isMe && myProfile?.avatarPhotoId ? (
      <Avatar photoId={myProfile.avatarPhotoId} size={size} />
    ) : avatars.get(p.member.userId) ? (
      <Avatar url={avatars.get(p.member.userId)} size={size} />
    ) : (
      <span className={styles.initial} style={{ width: size, height: size }} aria-hidden="true">
        {initialOf(p.member.displayName)}
      </span>
    );

  const longestText = (s: GroupStatsEntry | undefined) =>
    s?.longestCm === undefined
      ? '–'
      : `${speciesById(s.longestSpecies ?? '')?.de ?? ''} ${t.lengthValue(s.longestCm)}`.trim();

  const lines: string[] = [];
  const big = withStats.find((s) => s.userId === lead.longest);
  if (big?.longestCm !== undefined)
    lines.push(
      g.biggestText(
        nameOf(big.userId) ?? '',
        speciesById(big.longestSpecies ?? '')?.de ?? '',
        t.lengthValue(big.longestCm),
      ),
    );
  const bitesLead = withStats.find((s) => s.userId === lead.bites);
  if (bitesLead) lines.push(g.mostBites(nameOf(bitesLead.userId) ?? '', bitesLead.bites));
  const caughtLead = withStats.find((s) => s.userId === lead.caught);
  if (caughtLead && caughtLead.userId !== bitesLead?.userId)
    lines.push(g.mostCaught(nameOf(caughtLead.userId) ?? '', caughtLead.caught));

  const rows: {
    key: string;
    label: string;
    value: (s: GroupStatsEntry | undefined) => string;
    lead?: string;
  }[] = [
    { key: 'longest', label: g.biggest, value: longestText, ...(lead.longest ? { lead: lead.longest } : {}) },
    {
      key: 'caught',
      label: g.caught,
      value: (s) => (s ? String(s.caught) : '–'),
      ...(lead.caught ? { lead: lead.caught } : {}),
    },
    {
      key: 'bites',
      label: g.bites,
      value: (s) => (s ? String(s.bites) : '–'),
      ...(lead.bites ? { lead: lead.bites } : {}),
    },
    {
      key: 'time',
      label: g.time,
      value: (s) => (s ? formatDuration(s.activeMs) : '–'),
      ...(lead.time ? { lead: lead.time } : {}),
    },
  ];

  return (
    <>
      <section className={styles.section} aria-labelledby="rv-together">
        <h2 id="rv-together" className={styles.sectionTitle}>
          {g.title}
        </h2>
        <div className={styles.card}>
          <p className={styles.cardText}>{g.hint}</p>
          <ul className={styles.people} aria-label={g.participants}>
            {people.map((p) => (
              <li key={p.member.userId} className={styles.person}>
                {avatarOf(p, 48)}
                <span>{p.isMe ? `${p.member.displayName} (${g.you})` : p.member.displayName}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="rv-compare">
        <h2 id="rv-compare" className={styles.sectionTitle}>
          {g.compareTitle}
        </h2>
        {state.loading ? (
          <p className="muted">{g.loading}</p>
        ) : (
          <div className={styles.card}>
            <div className={styles.compareScroll}>
              <table className={styles.compare}>
                <thead>
                  <tr>
                    <th scope="col" className="visually-hidden">
                      {g.compareTitle}
                    </th>
                    {people.map((p) => (
                      <th key={p.member.userId} scope="col">
                        <span className={styles.colHead}>
                          {avatarOf(p, 40)}
                          <span>{p.name}</span>
                          {lead.longest === p.member.userId && (
                            <span className={styles.badge}>{g.badge}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{r.label}</th>
                      {people.map((p) => (
                        <td
                          key={p.member.userId}
                          className={r.lead === p.member.userId ? styles.winner : undefined}
                        >
                          {r.value(p.stats)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missing.length > 0 && (
              <p className={`muted ${styles.cardText}`}>{g.waiting(missing.join(', '))}</p>
            )}
            {state.failed && <p className={`muted ${styles.cardText}`}>{g.failed}</p>}
            <p className={`muted ${styles.cardText}`}>{g.privacy}</p>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="rv-total">
        <h2 id="rv-total" className={styles.sectionTitle}>
          {g.totalTitle}
        </h2>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {totals.distanceM === undefined ? t.distanceNone : t.km(totals.distanceM)}
            </span>
            <span className={styles.statLabel}>{t.distance}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totals.entries}</span>
            <span className={styles.statLabel}>{t.events}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatDuration(durationMs)}</span>
            <span className={styles.statLabel}>{t.duration}</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="rv-grouphl">
        <h2 id="rv-grouphl" className={styles.sectionTitle}>
          {g.highlightsTitle}
        </h2>
        <div className={styles.card}>
          {lines.length > 0 ? (
            lines.map((l) => (
              <p key={l} className={styles.cardText}>
                {l}
              </p>
            ))
          ) : (
            <p className={`muted ${styles.cardText}`}>{g.noLeader}</p>
          )}
        </div>
      </section>
    </>
  );
}

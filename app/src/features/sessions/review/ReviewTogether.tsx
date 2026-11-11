// Gemeinsame Session im Rückblick (Vorlage Nutzer 2026-11-11): Teilnehmer, „Highlights im Vergleich“, „Session
// gesamt“ – alles aus den Kennzahlen, die jede Person selbst hochgeladen hat. Keine Route
// und keine Einträge der anderen; wer noch nichts geteilt hat, steht mit „–“ da (nichts wird erfunden).
import type { ReactNode } from 'react';
import { de } from '../../../i18n/de';
import { ClockIcon, CupIcon, FishIcon, HookIcon } from '../../../design/icons';
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

  const rows: {
    key: string;
    label: string;
    icon: ReactNode;
    value: (s: GroupStatsEntry | undefined) => string;
    lead?: string;
  }[] = [
    {
      key: 'longest',
      label: g.biggest,
      icon: <FishIcon size={18} />,
      value: longestText,
      ...(lead.longest ? { lead: lead.longest } : {}),
    },
    {
      key: 'caught',
      label: g.caught,
      icon: <FishIcon size={18} />,
      value: (s) => (s ? String(s.caught) : '–'),
      ...(lead.caught ? { lead: lead.caught } : {}),
    },
    {
      key: 'bites',
      label: g.bites,
      icon: <HookIcon size={18} />,
      value: (s) => (s ? String(s.bites) : '–'),
      ...(lead.bites ? { lead: lead.bites } : {}),
    },
    {
      key: 'time',
      label: g.time,
      icon: <ClockIcon size={18} />,
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
          <>
            <ul
              className={[styles.vs, people.length < 2 ? styles.vsOne : ''].join(' ')}
              aria-label={g.compareTitle}
            >
              {people.map((p) => (
                <li key={p.member.userId} className={styles.vsCard}>
                  <div className={styles.vsHead}>
                    {avatarOf(p, 40)}
                    <span className={styles.vsName}>{p.name}</span>
                    {lead.longest === p.member.userId && (
                      <span className={styles.badge}>
                        <CupIcon size={14} />
                        {g.badge}
                      </span>
                    )}
                  </div>
                  <dl className={styles.vsRows}>
                    {rows.map((r) => (
                      <div key={r.key}>
                        <dt>
                          {r.icon}
                          <span>{r.label}</span>
                        </dt>
                        <dd
                          className={r.lead === p.member.userId ? styles.winner : undefined}
                          title={r.value(p.stats)}
                        >
                          {r.value(p.stats)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            {missing.length > 0 && <p className="muted">{g.waiting(missing.join(', '))}</p>}
            {state.failed && <p className="muted">{g.failed}</p>}
          </>
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
    </>
  );
}

// Angelkalender (Wunsch Nutzer 2026-10-22): Termine eintragen, Monat im Blick, Wetter am Gewässer für die
// nächsten 10 Tage. Termine bleiben auf dem Gerät und sind Teil der Sicherung.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Button, IconButton } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { Sheet } from '../../design/components/Sheet';
import { Toast } from '../../design/components/Toast';
import { SelectField, TextArea, TextField } from '../../design/components/Field';
import { SegmentedControl } from '../../design/components/SegmentedControl';
import { ChevronLeftIcon, ChevronRightIcon, WeatherIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { groupFriends } from '../../domain/friends';
import { toggleInvitee, type Invitee } from '../../domain/tripStart';
import { invitedWithReplies, type TripReply } from '../../domain/tripInvites';
import { useProviders } from '../../ports/providersContext';
import { useFriends } from '../friends/useFriends';
import { TripStartBusyError, startTripWithInvitees } from '../trips/startTrip';
import { sendTripInvites } from '../trips/sendInvites';
import { TripInvitesSection } from '../trips/TripInvitesSection';
import { useTripSync } from '../trips/useTripSync';
import { groupErrorText } from '../sessions/group/groupText';
import { repo } from '../../data/repository';
import { userMessage } from '../../data/errors';
import type { Trip } from '../../domain/schemas';
import { DEFAULT_TZ } from '../../domain/time';
import {
  emptyTripDraft,
  isoWeek,
  shiftDate,
  weekDays,
  type CalendarView,
  localDate,
  monthGrid,
  tripDraftFrom,
  tripDraftToFields,
  tripsOn,
  upcomingTrips,
  type TripDraft,
  type TripErrors,
  type TripField,
} from '../../domain/trip';
import { useWaterOptions, type PlaceOption } from '../weather/useForecastPlace';
import { useWeatherEnabled } from '../weather/useWeatherEnabled';
import { WeatherTabs } from '../weather/WeatherTabs';
import { TripWeather } from './TripWeather';
import { exportTrips } from './exportIcs';
import styles from './Calendar.module.css';

const t = de.calendar;
/** Auswahlwert für ein Gewässer, das ein bestehender Termin trägt, aber nicht (mehr) in der Liste steht */
const KEEP = 'keep';

const VIEW_KEY = 'fangpunkt.calendarView';
function readView(): CalendarView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'week' || v === 'day' ? v : 'month';
  } catch {
    return 'month';
  }
}

const waterLabel = (name?: string, place?: string) => (place ? `${name ?? ''} (${place})` : (name ?? ''));
const keyForTrip = (trip: Trip, options: PlaceOption[]) => {
  const w = trip.waterSnapshot;
  if (!w?.centroid) return w?.name ? KEEP : '';
  return options.find((o) => o.lat === w.centroid?.lat && o.lng === w.centroid?.lng)?.key ?? KEEP;
};

function TripForm({
  initial,
  date,
  options,
  onDone,
}: {
  initial?: Trip | undefined;
  date: string;
  options: PlaceOption[];
  onDone: (saved?: Trip, note?: string) => void;
}) {
  const { account } = useProviders();
  const { state: friends } = useFriends();
  const [invited, setInvited] = useState<Invitee[]>(() => initial?.invited ?? []);
  const [draft, setDraft] = useState<TripDraft>(() =>
    initial ? tripDraftFrom(initial, keyForTrip(initial, options)) : emptyTripDraft(date),
  );
  const [errors, setErrors] = useState<TripErrors>({});
  const [saveError, setSaveError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: TripField, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([x]) => x !== k)));
  };
  const err = (k: TripField) => (errors[k] ? t.errors[errors[k]] : undefined);
  const waterOptions = [
    { value: '', label: t.noWater },
    ...(draft.water === KEEP && initial?.waterSnapshot
      ? [{ value: KEEP, label: waterLabel(initial.waterSnapshot.name, initial.waterSnapshot.place) }]
      : []),
    ...options.map((o) => ({ value: o.key, label: waterLabel(o.label, o.sub) })),
  ];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { fields, errors: errs } = tripDraftToFields(draft);
    if (!fields) return setErrors(errs);
    const o = options.find((x) => x.key === draft.water);
    const waterSnapshot =
      draft.water === KEEP
        ? initial?.waterSnapshot
        : o
          ? { name: o.label, ...(o.sub ? { place: o.sub } : {}), centroid: { lat: o.lat, lng: o.lng } }
          : undefined;
    setBusy(true);
    try {
      const saved = initial
        ? await repo('trips').update(initial.id, { ...fields, waterSnapshot, invited })
        : await repo('trips').create({
            ...fields,
            tz: DEFAULT_TZ,
            ...(waterSnapshot ? { waterSnapshot } : {}),
            ...(invited.length ? { invited } : {}),
          });
      // neu Eingeladene bekommen die Einladung; schlägt das fehl, gilt der Termin trotzdem (wird nachgeholt)
      const before = new Set((initial?.invited ?? []).filter((i) => i.sent).map((i) => i.userId));
      const fresh = invited.filter((i) => !before.has(i.userId));
      let note: string | undefined;
      if (fresh.length > 0)
        note = (await sendTripInvites(
          account,
          saved,
          fresh.map((i) => i.userId),
        ))
          ? t.inviteSent
          : t.inviteFailed;
      onDone(saved, note);
    } catch (x) {
      setSaveError(userMessage(x));
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void save(e)} noValidate>
      <TextField
        label={t.date}
        type="date"
        value={draft.date}
        onChange={(e) => set('date', e.target.value)}
        error={err('date')}
        required
      />
      <div className={styles.row}>
        <TextField
          label={t.from}
          type="time"
          value={draft.from}
          onChange={(e) => set('from', e.target.value)}
        />
        <TextField
          label={t.to}
          type="time"
          value={draft.to}
          onChange={(e) => set('to', e.target.value)}
          error={err('to')}
        />
      </div>
      <SelectField
        label={t.water}
        hint={t.waterHint}
        options={waterOptions}
        value={draft.water}
        onChange={(e) => set('water', e.target.value)}
      />
      <TextField
        label={t.name}
        placeholder={t.namePlaceholder}
        maxLength={120}
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
      />
      <TextArea
        label={t.notes}
        maxLength={2000}
        value={draft.notes}
        onChange={(e) => set('notes', e.target.value)}
      />
      {friends.kind === 'ready' && (
        <fieldset className={styles.invite}>
          <legend>{t.inviteTitle}</legend>
          {groupFriends(friends.list).friends.length === 0 ? (
            <p className="muted">{t.inviteNone}</p>
          ) : (
            groupFriends(friends.list).friends.map((f) => (
              <label key={f.userId} className={styles.inviteRow}>
                <input
                  type="checkbox"
                  checked={invited.some((i) => i.userId === f.userId)}
                  onChange={() =>
                    setInvited((cur) => toggleInvitee(cur, { userId: f.userId, name: f.displayName }))
                  }
                />
                <span>{f.displayName}</span>
              </label>
            ))
          )}
        </fieldset>
      )}
      {saveError && <Notice tone="error">{saveError}</Notice>}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={() => onDone()}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={busy}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}

function TripCard({
  trip,
  today,
  weather,
  showDate,
  onEdit,
  onDelete,
  onExport,
  onStart,
  replies,
}: {
  trip: Trip;
  today: string;
  weather: boolean;
  showDate: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  /** nur mit Eingeladenen und am Tag des Termins */
  onStart?: (() => void) | undefined;
  /** Antworten der Eingeladenen (zugesagt/abgesagt) */
  replies: readonly TripReply[];
}) {
  const head = [showDate && t.dayTitle(trip.date), t.time(trip.from, trip.to)].filter(Boolean).join(' · ');
  const name = trip.title ?? waterLabel(trip.waterSnapshot?.name, trip.waterSnapshot?.place);
  return (
    <li className={styles.trip}>
      <p className={styles.tripHead}>{head}</p>
      {name && <p className={styles.tripName}>{name}</p>}
      {trip.title && trip.waterSnapshot?.name && (
        <p className="muted">{waterLabel(trip.waterSnapshot.name, trip.waterSnapshot.place)}</p>
      )}
      {trip.notes && <p className={styles.notes}>{trip.notes}</p>}
      {trip.invited && trip.invited.length > 0 && (
        <p className="muted">
          {t.invitedLine(
            invitedWithReplies(trip.invited, replies, trip.id, {
              accepted: t.replyAccepted,
              declined: t.replyDeclined,
            }).join(', '),
          )}
        </p>
      )}
      {trip.invitedBy && <p className="muted">{t.inviteFrom(trip.invitedBy.name)}</p>}
      <TripWeather trip={trip} today={today} enabled={weather} />
      <div className={styles.actions}>
        {onStart && (
          <Button onClick={onStart} aria-label={t.startSessionLabel(head)}>
            {t.startSession}
          </Button>
        )}
        <Button variant="secondary" onClick={onEdit} aria-label={`${head}: ${t.edit}`}>
          {t.edit}
        </Button>
        <Button variant="secondary" onClick={onExport} aria-label={t.toCalendarLabel(head)}>
          {t.toCalendar}
        </Button>
        <Button variant="danger" onClick={onDelete} aria-label={`${head}: ${t.delete}`}>
          {t.delete}
        </Button>
      </div>
    </li>
  );
}

export function CalendarPage() {
  const { account } = useProviders();
  const trips = useLiveQuery(() => getDb().trips.toArray(), []);
  const options = useWaterOptions();
  const weather = useWeatherEnabled();
  const [today] = useState(() => localDate(Date.now()));
  // Gewählter Tag ist zugleich Anker der Ansicht (Monat/Woche/Tag)
  const [selected, setSelected] = useState(today);
  const [view, setViewState] = useState<CalendarView>(readView);
  const setView = (v: CalendarView) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // nur Komfort
    }
  };
  const month = selected.slice(0, 7);
  // 'new' oder id des bearbeiteten Termins
  const [editing, setEditing] = useState<string>();
  const [toast, setToast] = useState<{ text: string; undoId?: string }>();

  const live = useMemo(() => (trips ?? []).filter((x) => !x.deletedAt), [trips]);
  const count = useMemo(() => {
    const n = new Map<string, number>();
    for (const x of live) n.set(x.date, (n.get(x.date) ?? 0) + 1);
    return n;
  }, [live]);
  const grid = useMemo(() => monthGrid(month), [month]);
  const dayTrips = tripsOn(live, selected);
  const week = useMemo(() => weekDays(selected), [selected]);
  const weekTrips = week.flatMap((d) => tripsOn(live, d));
  const upcoming = upcomingTrips(live, today).slice(0, 10);
  const replies = useTripSync(live, today);

  if (!trips || !options || weather === undefined)
    return (
      <Page title={de.forecast.title}>
        <WeatherTabs />
        <Notice>{t.loading}</Notice>
      </Page>
    );

  async function remove(x: Trip) {
    await repo('trips').remove(x.id);
    // Einladungen zurückziehen (Eingeladene behalten, was sie schon übernommen haben)
    if (x.invited?.length) void account.cancelTripInvites(x.id).catch(() => undefined);
    setToast({ text: t.deleted, undoId: x.id });
  }
  /** Start mit Eingeladenen: das Warten übernimmt das globale Fenster (TripStartHost) */
  async function startTrip(x: Trip) {
    try {
      await startTripWithInvitees(account, x);
    } catch (e) {
      setToast({
        text:
          e instanceof TripStartBusyError
            ? de.tripStart.busy
            : !navigator.onLine
              ? de.tripStart.offline
              : groupErrorText(e),
      });
    }
  }
  const card = (x: Trip, showDate: boolean) => (
    <TripCard
      key={x.id}
      trip={x}
      today={today}
      weather={weather}
      showDate={showDate}
      onEdit={() => setEditing(x.id)}
      onDelete={() => void remove(x)}
      onExport={() => void exportTrips([x], `angeltermin-${x.date}.ics`)}
      onStart={x.invited?.length && x.date === today ? () => void startTrip(x) : undefined}
      replies={replies}
    />
  );
  const editTrip = live.find((x) => x.id === editing);

  return (
    <Page title={de.forecast.title}>
      <WeatherTabs />
      <p className="muted">{t.intro}</p>
      <TripInvitesSection />

      <div className={styles.toolbar}>
        <SegmentedControl
          label={t.viewLabel}
          options={(['month', 'week', 'day'] as const).map((v) => ({ value: v, label: t.views[v] }))}
          value={view}
          onChange={setView}
        />
        <Button variant="secondary" onClick={() => setSelected(today)} aria-label={t.goTodayLabel}>
          {t.goToday}
        </Button>
      </div>

      <section className={styles.month} aria-labelledby="cal-title">
        <div className={styles.monthHead}>
          <IconButton
            label={view === 'month' ? t.prevMonth : view === 'week' ? t.prevWeek : t.prevDay}
            icon={<ChevronLeftIcon />}
            onClick={() => setSelected((d) => shiftDate(d, view, -1))}
          />
          <h2 id="cal-title" className={styles.monthTitle} aria-live="polite">
            {view === 'month'
              ? t.monthTitle(month)
              : view === 'week'
                ? t.weekTitle(isoWeek(selected), week[0] ?? selected, week[6] ?? selected)
                : t.dayTitle(selected)}
          </h2>
          <IconButton
            label={view === 'month' ? t.nextMonth : view === 'week' ? t.nextWeek : t.nextDay}
            icon={<ChevronRightIcon />}
            onClick={() => setSelected((d) => shiftDate(d, view, 1))}
          />
        </div>
        {view !== 'day' && (
          <table className={styles.grid}>
            <thead>
              <tr>
                {t.weekdays.map((d) => (
                  <th key={d} scope="col">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(view === 'month' ? grid : [week.map((date) => ({ date, inMonth: true }))]).map((row) => (
                <tr key={row[0]?.date}>
                  {row.map((c) => {
                    const n = count.get(c.date) ?? 0;
                    return (
                      <td key={c.date}>
                        <button
                          type="button"
                          className={[
                            styles.day,
                            c.inMonth ? '' : styles.outside,
                            c.date === today ? styles.today : '',
                            c.date === selected ? styles.selected : '',
                          ].join(' ')}
                          aria-pressed={c.date === selected}
                          aria-label={t.dayLabel(c.date, n)}
                          aria-current={c.date === today ? 'date' : undefined}
                          onClick={() => setSelected(c.date)}
                        >
                          <span>{Number(c.date.slice(8))}</span>
                          {n > 0 && <span className={styles.dot} aria-hidden="true" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {view === 'week' ? (
        <Section title={t.weekTrips}>
          {weekTrips.length === 0 ? (
            <p className="muted">{t.noTripsWeek}</p>
          ) : (
            <ul className={styles.trips}>{weekTrips.map((x) => card(x, true))}</ul>
          )}
          <Button onClick={() => setEditing('new')}>{t.add}</Button>
        </Section>
      ) : (
        <Section
          title={
            view === 'day'
              ? t.dayTrips
              : selected === today
                ? `${t.today}, ${t.dayTitle(selected)}`
                : t.dayTitle(selected)
          }
        >
          {dayTrips.length === 0 ? (
            <p className="muted">{t.noTripsDay}</p>
          ) : (
            <ul className={styles.trips}>{dayTrips.map((x) => card(x, false))}</ul>
          )}
          <Button onClick={() => setEditing('new')}>{t.add}</Button>
        </Section>
      )}

      <Section title={t.upcoming}>
        {upcoming.length === 0 ? (
          <EmptyState icon={<WeatherIcon size={32} />} title={t.emptyTitle}>
            {t.emptyText}
          </EmptyState>
        ) : (
          <>
            <ul className={styles.trips}>{upcoming.map((x) => card(x, true))}</ul>
            {upcoming.length > 1 && (
              <Button
                variant="secondary"
                onClick={() => void exportTrips(upcoming, `angeltermine-ab-${today}.ics`)}
              >
                {t.allToCalendar}
              </Button>
            )}
            <p className="muted">{t.toCalendarHint}</p>
          </>
        )}
        {weather && <p className="muted">{t.weatherSource}</p>}
      </Section>

      <Sheet
        open={!!editing}
        title={editTrip ? t.editTitle : t.newTitle}
        onClose={() => setEditing(undefined)}
      >
        {editing && (
          <TripForm
            key={editing}
            initial={editTrip}
            date={selected}
            options={options}
            onDone={(saved, note) => {
              setEditing(undefined);
              if (saved) setSelected(saved.date);
              if (note) setToast({ text: note });
            }}
          />
        )}
      </Sheet>

      {toast && (
        <Toast
          onDismiss={() => setToast(undefined)}
          actions={
            toast.undoId && (
              <Button
                variant="ghost"
                onClick={() => {
                  const id = toast.undoId ?? '';
                  void repo('trips')
                    .restore(id)
                    .then(() => setToast({ text: t.restored }));
                }}
              >
                {t.undo}
              </Button>
            )
          }
        >
          {toast.text}
        </Toast>
      )}
    </Page>
  );
}

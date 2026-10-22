// Reiter je Gewässer im Fangbuch: Name und darunter der Ort; unbekannte Gewässer umbenennbar (nur im Fangbuch).
import { useMemo, useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { TextField } from '../../design/components/Field';
import { renameUnknownWater } from '../../data/waterPlaceService';
import { userMessage } from '../../data/errors';
import { searchGroups, type WaterGroup } from '../../domain/waterGroups';
import styles from './CatchesPage.module.css';

const t = de.catches;
const groupName = (g: WaterGroup) => g.name ?? t.unknownWater;

export function WaterTabs({
  groups,
  selected,
  onSelect,
}: {
  groups: WaterGroup[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => searchGroups(groups, query, t.unknownWater), [groups, query]);
  return (
    <section className={styles.waters} aria-label={t.waters}>
      <TextField
        label={t.waterSearch}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.tabs} role="group" aria-label={t.waters}>
        {!query && (
          <button
            type="button"
            className={styles.tab}
            aria-pressed={selected === ''}
            onClick={() => onSelect('')}
          >
            <span className={styles.tabName}>{t.allTab}</span>
            <span className={styles.tabPlace}>{t.allWatersCount(groups.length)}</span>
          </button>
        )}
        {shown.map((g) => (
          <button
            key={g.key}
            type="button"
            className={styles.tab}
            aria-pressed={selected === g.key}
            onClick={() => onSelect(g.key)}
          >
            <span className={styles.tabName}>{groupName(g)}</span>
            <span className={styles.tabPlace}>
              {g.place ?? t.placeUnknown} · {g.ids.length}
            </span>
          </button>
        ))}
      </div>
      {query && shown.length === 0 && <p className="muted">{t.waterSearchNone}</p>}
    </section>
  );
}

/** Kopf des gewählten Gewässers; bei unbekannten mit „Namen ändern". */
export function WaterHeader({ group }: { group: WaterGroup }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name ?? '');
  const [error, setError] = useState<string>();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await renameUnknownWater(group.ids, name);
      setEditing(false);
    } catch (x) {
      setError(userMessage(x));
    }
  }
  return (
    <div className={styles.waterHead}>
      <h2 className={styles.waterTitle}>{groupName(group)}</h2>
      <p className="muted">{group.place ?? t.placeUnknown}</p>
      {group.kind === 'known' ? (
        <p className="muted">{t.knownName}</p>
      ) : editing ? (
        <form className={styles.renameForm} onSubmit={(e) => void save(e)}>
          <TextField
            label={t.renameLabel}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="muted">{t.renameHint}</p>
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button type="submit">{t.renameSave}</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setName(group.name ?? '');
                setEditing(false);
              }}
            >
              {t.renameCancel}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t.rename}
          </Button>
        </div>
      )}
    </div>
  );
}

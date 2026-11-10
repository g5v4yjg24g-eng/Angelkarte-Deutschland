// Fischart und Länge am Beitrag (Paket 7a, freiwillig). Beim Posten aus einem Fang vorausgefüllt; der Fangort wird
// nie mitgeschickt. Auch die Anzeige als kleines Etikett („Hecht · 87 cm“) für Feed und Beitragsseite.
import { de } from '../../i18n/de';
import { SelectField, TextField } from '../../design/components/Field';
import { SPECIES, speciesById } from '../../domain/species';
import styles from './Profile.module.css';

const t = de.profile.catchInfo;
const OPTIONS = [
  { value: '', label: t.noSpecies },
  ...[...SPECIES].sort((a, b) => a.de.localeCompare(b.de, 'de')).map((s) => ({ value: s.id, label: s.de })),
];

export function CatchInfoFields({
  speciesId,
  length,
  lengthError,
  onSpecies,
  onLength,
}: {
  speciesId: string;
  length: string;
  lengthError?: string | undefined;
  onSpecies: (v: string) => void;
  onLength: (v: string) => void;
}) {
  return (
    <fieldset className={styles.catchInfo}>
      <legend>{t.title}</legend>
      <div className={styles.catchInfoRow}>
        <SelectField
          label={t.species}
          value={speciesId}
          options={OPTIONS}
          onChange={(e) => onSpecies(e.target.value)}
        />
        <TextField
          label={t.length}
          inputMode="decimal"
          value={length}
          error={lengthError}
          onChange={(e) => onLength(e.target.value)}
        />
      </div>
      <small className="muted">{t.hint}</small>
    </fieldset>
  );
}

/** Kleines Etikett „Hecht · 87 cm“; nichts, wenn beides fehlt */
/** Fischart · Länge – als Zeile unter dem Namen (wie der Ort bei Instagram) oder als Etikett */
export function CatchTag({
  speciesId,
  lengthCm,
  variant = 'tag',
}: {
  speciesId?: string | undefined;
  lengthCm?: number | undefined;
  variant?: 'tag' | 'line';
}) {
  const name = speciesById(speciesId)?.de;
  const len = lengthCm !== undefined ? `${lengthCm.toLocaleString('de-DE')} cm` : undefined;
  const text = [name, len].filter(Boolean).join(' · ');
  if (!text) return null;
  return (
    <p className={variant === 'line' ? styles.catchLine : styles.catchTag}>
      <span className="visually-hidden">{t.tagLabel}: </span>
      {text}
    </p>
  );
}

// Freiwillige Profilangaben (Paket 11, Masterprompt 6.1): Lieblingsfische, bevorzugte Methoden, Region.
import { de } from '../../i18n/de';
import { SelectField } from '../../design/components/Field';
import { SPECIES, speciesById } from '../../domain/species';
import { MAX_TARGET_SPECIES, toggleInList } from '../../domain/profile';
import { MethodSchema, type Profile } from '../../domain/schemas';
import { STATE_CODES, type StateCode } from '../../domain/water';
import { CloseIcon } from '../../design/icons';
import styles from './Profile.module.css';

const t = de.profile;
export interface ProfileExtras {
  targetSpecies: string[];
  methods: NonNullable<Profile['methods']>;
  region?: Profile['region'];
}

const METHODS = MethodSchema.options.filter((m) => m !== 'other');
const SPECIES_SORTED = [...SPECIES].sort((a, b) => a.de.localeCompare(b.de, 'de'));

export function ProfileExtrasFields({
  value,
  onChange,
}: {
  value: ProfileExtras;
  onChange: (v: ProfileExtras) => void;
}) {
  const full = value.targetSpecies.length >= MAX_TARGET_SPECIES;
  const left = SPECIES_SORTED.filter((s) => !value.targetSpecies.includes(s.id));
  return (
    <fieldset className={styles.extras}>
      <legend>{t.extrasTitle}</legend>

      <div>
        <span className={styles.fieldLabel}>{t.targetSpecies}</span>
        {value.targetSpecies.length > 0 && (
          <ul
            className={styles.chips}
            aria-label={t.targetSpecies}
            style={{ listStyle: 'none', padding: 0, margin: 'var(--space-2) 0' }}
          >
            {value.targetSpecies.map((id) => {
              const name = speciesById(id)?.de ?? id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={styles.chip}
                    aria-label={t.removeSpecies(name)}
                    onClick={() =>
                      onChange({ ...value, targetSpecies: value.targetSpecies.filter((x) => x !== id) })
                    }
                  >
                    {name} <CloseIcon size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <SelectField
          label={t.targetSpeciesAdd}
          {...(full ? { hint: t.targetSpeciesMax(MAX_TARGET_SPECIES) } : {})}
          disabled={full}
          value=""
          options={[
            { value: '', label: t.targetSpeciesPick },
            ...left.map((s) => ({ value: s.id, label: s.de })),
          ]}
          onChange={(e) => {
            const id = e.target.value;
            if (id)
              onChange({
                ...value,
                targetSpecies: toggleInList(value.targetSpecies, id, MAX_TARGET_SPECIES),
              });
          }}
        />
      </div>

      <div role="group" aria-label={t.methodsLabel}>
        <span className={styles.fieldLabel} aria-hidden="true">
          {t.methodsLabel}
        </span>
        <div className={styles.chips}>
          {METHODS.map((m) => {
            const on = value.methods.includes(m);
            return (
              <button
                key={m}
                type="button"
                className={styles.chip}
                aria-pressed={on}
                onClick={() => onChange({ ...value, methods: toggleInList(value.methods, m, 5) })}
              >
                {de.catchForm.methods[m]}
              </button>
            );
          })}
        </div>
      </div>

      <SelectField
        label={t.regionLabel}
        value={value.region ?? ''}
        options={[
          { value: '', label: t.regionNone },
          ...STATE_CODES.map((c) => ({ value: c, label: de.water.states[c] })),
        ]}
        onChange={(e) =>
          onChange({
            targetSpecies: value.targetSpecies,
            methods: value.methods,
            ...(e.target.value ? { region: e.target.value as StateCode } : {}),
          })
        }
      />
    </fieldset>
  );
}

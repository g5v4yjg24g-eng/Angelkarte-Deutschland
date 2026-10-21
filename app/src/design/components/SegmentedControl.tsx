import { useId } from 'react';
import styles from './SegmentedControl.module.css';

/** Auswahl aus wenigen Optionen als Radiogruppe (tastatur- und screenreaderfähig). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className={styles.group}>
      <legend className="visually-hidden">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

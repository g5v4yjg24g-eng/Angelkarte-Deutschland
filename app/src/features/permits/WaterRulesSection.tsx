// Eigene Regeln eines Gewässers (Paket 9A): vom Erlaubnisschein abgetippt, klar als ungeprüfte Notiz gekennzeichnet.
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { TextArea } from '../../design/components/Field';
import { getWaterRules, saveWaterRules } from '../../data/waterRulesService';
import styles from './Permit.module.css';

const t = de.waterRules;

export function WaterRulesSection({ waterId }: { waterId: string }) {
  const rules = useLiveQuery(() => getWaterRules(waterId), [waterId]);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const start = () => {
    setText(rules?.text ?? '');
    setEditing(true);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveWaterRules(waterId, text);
    setEditing(false);
  };

  if (editing)
    return (
      <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
        <TextArea
          label={t.label}
          placeholder={t.placeholder}
          maxLength={2000}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          hint={t.unchecked}
          autoFocus
        />
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            {t.cancel}
          </Button>
          <Button type="submit">{t.save}</Button>
        </div>
      </form>
    );
  if (!rules)
    return (
      <div className={styles.own}>
        <Button variant="ghost" onClick={start}>
          {t.add}
        </Button>
      </div>
    );
  return (
    <section className={styles.own} aria-labelledby={`rules-${waterId}`}>
      <span id={`rules-${waterId}`} className={styles.kicker}>
        {t.title}
      </span>
      <p className={styles.rulesText}>{rules.text}</p>
      <p className={`muted ${styles.small}`}>{t.unchecked}</p>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={start}>
          {t.edit}
        </Button>
        <Button variant="ghost" onClick={() => void saveWaterRules(waterId, '')}>
          {t.remove}
        </Button>
      </div>
    </section>
  );
}

/** Kurzfassung in der Rechts-Prüfung beim Fang (nur wenn vorhanden) */
export function WaterRulesNote({ waterId }: { waterId: string | undefined }) {
  const rules = useLiveQuery(async () => (waterId ? getWaterRules(waterId) : undefined), [waterId]);
  if (!rules) return null;
  return (
    <div className={styles.own}>
      <span className={styles.kicker}>{t.inCheck}</span>
      <p className={styles.rulesText}>{rules.text}</p>
    </div>
  );
}

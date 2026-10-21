import { useId, useRef, useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Notice } from '../../design/components/Notice';
import { applyImport, prepareImport, readBackupFile, type ReadBackup } from '../../data/backupService';
import { userMessage } from '../../data/errors';
import {
  PLAN_TABLES,
  selectWrites,
  summarize,
  type ImportPlan,
  type ImportStrategy,
} from '../../domain/backup/plan';
import styles from './BackupPage.module.css';

type State =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'preview'; read: ReadBackup; plan: ImportPlan; fileName: string }
  | { step: 'importing' }
  | { step: 'done'; written: number }
  | { step: 'error'; message: string };

const STRATEGIES: ImportStrategy[] = ['keepNewer', 'fileWins', 'onlyNew'];

export function ImportPanel() {
  const [state, setState] = useState<State>({ step: 'idle' });
  const [strategy, setStrategy] = useState<ImportStrategy>('keepNewer');
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setState({ step: 'reading' });
    try {
      const read = await readBackupFile(file);
      setState({ step: 'preview', read, plan: await prepareImport(read), fileName: file.name });
    } catch (e) {
      setState({ step: 'error', message: userMessage(e) });
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  async function onImport(read: ReadBackup, plan: ImportPlan) {
    setState({ step: 'importing' });
    try {
      const r = await applyImport(read, plan, strategy);
      setState({ step: 'done', written: r.written });
    } catch (e) {
      setState({ step: 'error', message: userMessage(e) });
    }
  }

  return (
    <div className={styles.stack}>
      <p className="muted">{de.backup.importHint}</p>
      <div>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          className="visually-hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <label htmlFor={inputId} className={styles.fileButton}>
          {de.backup.chooseFile}
        </label>
      </div>

      {state.step === 'reading' && <Notice>{de.backup.reading}</Notice>}
      {state.step === 'error' && <Notice tone="error">{state.message}</Notice>}
      {state.step === 'done' && <Notice tone="success">{de.backup.importDone(state.written)}</Notice>}
      {state.step === 'preview' && (
        <Preview
          {...state}
          strategy={strategy}
          onStrategy={setStrategy}
          onCancel={() => setState({ step: 'idle' })}
          onImport={() => void onImport(state.read, state.plan)}
        />
      )}
    </div>
  );
}

function Preview({
  read,
  plan,
  fileName,
  strategy,
  onStrategy,
  onCancel,
  onImport,
}: {
  read: ReadBackup;
  plan: ImportPlan;
  fileName: string;
  strategy: ImportStrategy;
  onStrategy: (s: ImportStrategy) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const sum = summarize(plan);
  const writes = Object.values(selectWrites(plan, strategy)).reduce((n, rows) => n + rows.length, 0);
  const name = useId();
  const { parsed } = read;
  return (
    <section className={styles.preview} aria-labelledby={`${name}-t`}>
      <h3 id={`${name}-t`}>{de.backup.previewTitle}</h3>
      <p className="muted">{fileName}</p>
      {parsed.notes.length > 0 && (
        <Notice>
          <ul className={styles.notes}>
            {parsed.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Notice>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{de.backup.colNew}</th>
            <th scope="col">{de.backup.colSame}</th>
            <th scope="col">{de.backup.colConflict}</th>
          </tr>
        </thead>
        <tbody>
          {PLAN_TABLES.filter((t) => (parsed.records[t] as unknown[]).length > 0).map((t) => (
            <tr key={t}>
              <th scope="row">{de.backup.tables[t]}</th>
              <td className="tabular">{plan[t].added.length}</td>
              <td className="tabular">{plan[t].identical}</td>
              <td className="tabular">{plan[t].incomingNewer.length + plan[t].existingNewer.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {parsed.invalid.length > 0 && (
        <details className={styles.invalid}>
          <summary>{de.backup.invalidTitle(parsed.invalid.length)}</summary>
          <ul>
            {parsed.invalid.slice(0, 50).map((x) => (
              <li key={`${x.table}-${x.index}`}>
                {de.backup.tables[x.table]} #{x.index + 1}
                {x.id ? ` (${x.id})` : ''}: {x.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {sum.conflicts > 0 && (
        <fieldset className={styles.strategies}>
          <legend>{de.backup.strategyTitle}</legend>
          {STRATEGIES.map((s) => (
            <label key={s} className={styles.strategy}>
              <input type="radio" name={name} checked={strategy === s} onChange={() => onStrategy(s)} />
              <span>
                <strong>{de.backup.strategies[s].label}</strong>
                <span className="muted">{de.backup.strategies[s].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {writes === 0 && <Notice>{de.backup.nothingToImport}</Notice>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          {de.backup.cancel}
        </Button>
        <Button onClick={onImport} disabled={writes === 0}>
          {de.backup.importAction(writes)}
        </Button>
      </div>
    </section>
  );
}

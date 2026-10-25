// Fenster „Neu in Fangpunkt“ nach einem Update: einmal je Person und Gerät, erst nach dem Intro.
// Natives dialog (Fokusfalle, Escape). In automatisierten Tests nur, wenn ausdrücklich eingeschaltet.
import { useEffect, useRef, useState } from 'react';
import { de } from '../../i18n/de';
import { CHANGELOG } from '../../i18n/changelog';
import { Button } from '../../design/components/Button';
import { getDb } from '../../data/db';
import { getSetting, setSetting } from '../../data/settings';
import { latestId, unseenEntries, type ChangelogEntry } from '../../domain/whatsNew';
import styles from './WhatsNew.module.css';

const TEST_FLAG = 'fangpunkt.e2e.whatsNew';

function testsAllowed(): boolean {
  if (!navigator.webdriver) return true;
  try {
    return localStorage.getItem(TEST_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Wartet, bis das Intro (index.html) weg ist. */
function afterIntro(cb: () => void): () => void {
  const root = document.documentElement;
  if (root.dataset.intro !== 'shown') {
    cb();
    return () => undefined;
  }
  const obs = new MutationObserver(() => {
    if (root.dataset.intro !== 'shown') {
      obs.disconnect();
      cb();
    }
  });
  obs.observe(root, { attributes: true, attributeFilter: ['data-intro'] });
  return () => obs.disconnect();
}

async function hasUserData(): Promise<boolean> {
  const db = getDb();
  const counts = await Promise.all([
    db.catches.count(),
    db.places.count(),
    db.sessions.count(),
    db.trips.count(),
  ]);
  return counts.some((n) => n > 0);
}

/** „Stichwort: Text“ → Stichwort fett */
export function NewsItem({ text }: { text: string }) {
  const i = text.indexOf(': ');
  if (i < 0 || i > 40) return <>{text}</>;
  return (
    <>
      <strong>{text.slice(0, i)}:</strong> {text.slice(i + 2)}
    </>
  );
}

export function WhatsNew({ entries = CHANGELOG }: { entries?: readonly ChangelogEntry[] }) {
  const [show, setShow] = useState<ChangelogEntry[]>([]);
  const ref = useRef<HTMLDialogElement>(null);
  const latest = latestId(entries);

  useEffect(() => {
    if (!latest || !testsAllowed()) return;
    let stop: () => void = () => undefined;
    let alive = true;
    void (async () => {
      const [lastSeen, data] = await Promise.all([getSetting('lastSeenChangelog'), hasUserData()]);
      if (!alive) return;
      const unseen = unseenEntries(entries, lastSeen, data);
      // Neue Installation: Stand merken, ohne Fenster
      if (!unseen.length) {
        if (lastSeen === undefined) await setSetting('lastSeenChangelog', latest);
        return;
      }
      stop = afterIntro(() => alive && setShow(unseen));
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [entries, latest]);

  useEffect(() => {
    const d = ref.current;
    if (show.length && d && !d.open) d.showModal();
  }, [show]);

  if (!show.length || !latest) return null;
  const close = () => {
    ref.current?.close();
    setShow([]);
    void setSetting('lastSeenChangelog', latest);
  };
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="whatsnew-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <h2 id="whatsnew-title" className={styles.title}>
        {de.whatsNew.title}
      </h2>
      <div className={styles.body}>
        {show.map((e) => (
          <section key={e.id} aria-label={e.title}>
            {show.length > 1 && <h3 className={styles.entryTitle}>{e.title}</h3>}
            <ul className={styles.list}>
              {e.items.map((it) => (
                <li key={it}>
                  <NewsItem text={it} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className={styles.actions}>
        <Button onClick={close} autoFocus>
          {de.whatsNew.ok}
        </Button>
      </div>
    </dialog>
  );
}

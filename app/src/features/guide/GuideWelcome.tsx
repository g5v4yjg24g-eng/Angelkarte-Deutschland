// Willkommensblatt beim ersten Start (nur neue Installation, nach dem Intro): „Kurze Tour“ oder „Später“. Bestandsnutzer
// bekommen nie ein Fenster; ihr Stand wird still gemerkt. In automatisierten Tests nur, wenn ausdrücklich eingeschaltet.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { Sheet } from '../../design/components/Sheet';
import { hasUserData } from '../../data/hasUserData';
import { getSetting } from '../../data/settings';
import { shouldMarkSilently, shouldOfferWelcome } from '../../domain/guide';
import { afterIntro } from '../../lib/afterIntro';
import { GuideTour } from './GuideTour';
import { markGuideSeen } from './guideState';
import styles from './Guide.module.css';

const TEST_FLAG = 'fangpunkt.e2e.guide';

function testsAllowed(): boolean {
  if (!navigator.webdriver) return true;
  try {
    return localStorage.getItem(TEST_FLAG) === '1';
  } catch {
    return false;
  }
}

export function GuideWelcome() {
  const [step, setStep] = useState<'none' | 'welcome' | 'tour'>('none');

  useEffect(() => {
    if (!testsAllowed()) return;
    let stop: () => void = () => undefined;
    let alive = true;
    void (async () => {
      const [seen, data] = await Promise.all([getSetting('guideSeen'), hasUserData()]);
      if (!alive) return;
      if (shouldMarkSilently(seen, data)) {
        void markGuideSeen();
        return;
      }
      if (shouldOfferWelcome(seen, data)) stop = afterIntro(() => alive && setStep('welcome'));
    })();
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const w = de.guide.welcome;
  return (
    <>
      <Sheet
        open={step === 'welcome'}
        title={w.title}
        onClose={() => {
          void markGuideSeen();
          setStep('none');
        }}
      >
        <div className={styles.welcome}>
          <p>{w.text}</p>
          <div className={styles.welcomeActions}>
            <Button onClick={() => setStep('tour')}>{w.start}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                void markGuideSeen();
                setStep('none');
              }}
            >
              {w.later}
            </Button>
          </div>
        </div>
      </Sheet>
      <GuideTour open={step === 'tour'} onClose={() => setStep('none')} />
    </>
  );
}

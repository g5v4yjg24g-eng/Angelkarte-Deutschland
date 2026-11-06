// Gleicht im Hintergrund die erreichten Stufen ab (Variante A: dazunehmen, nie entfernen). Neue Stufen werden als
// „neu“ gemerkt und im Profil angezeigt, bis die Erfolge-Übersicht geöffnet wird – kein schwebender Hinweis, der
// andere Hinweise verdeckt (Fänge zählen erst nach einem Tag, eine neue Stufe käme sonst zu zufälligen Zeitpunkten).
// Beim allerersten Abgleich still.
import { useEffect } from 'react';
import { getSetting, setSetting } from '../../data/settings';
import { mergeUnlocked } from '../../domain/achievements';
import { useAchievements } from './useAchievements';

export function AchievementSync() {
  const state = useAchievements();
  useEffect(() => {
    if (!state) return;
    const { next, fresh } = mergeUnlocked(state.unlocked, state.progress, new Date().toISOString());
    if (state.stored && fresh.length === 0) return;
    void (async () => {
      await setSetting('achievements', next);
      if (fresh.length) {
        const prev = (await getSetting('achievementsNew')) ?? [];
        await setSetting('achievementsNew', [...new Set([...prev, ...fresh])]);
      }
    })();
  }, [state]);
  return null;
}

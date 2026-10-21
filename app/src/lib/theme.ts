// Theme-Wahl je Gerät (localStorage, weil sie vor dem ersten Zeichnen gelesen werden muss – siehe index.html).
export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_KEY = 'fangpunkt.theme';

export function readTheme(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): ThemeChoice {
  try {
    const v = storage?.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(
  choice: ThemeChoice,
  root: HTMLElement = document.documentElement,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = safeStorage(),
): void {
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, choice);
  } catch {
    // Speichern nicht möglich (z. B. privater Modus): Theme gilt nur für diese Sitzung.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// iOS-Homescreen-App: Beim Start ist die Anzeigefläche teils um die Statusleiste zu kurz – unten bleibt ein dunkler
// Streifen und die Leiste sitzt zu hoch, bis man einmal wischt (Meldung Nutzer 2026-10-22). Abhilfe [A, nicht am
// Gerät nachgestellt]: beim Start und bei Rückkehr einmal um 1 px scrollen und zurück. Das stößt dieselbe
// Neuberechnung an wie das Wischen von Hand. Nur in der iOS-Homescreen-App, sonst passiert nichts.

type Win = Pick<Window, 'scrollTo' | 'requestAnimationFrame' | 'addEventListener'> & {
  navigator: { standalone?: boolean };
  document: Pick<Document, 'documentElement' | 'visibilityState' | 'addEventListener'>;
};

export function nudgeViewport(win: Win): void {
  const el = win.document.documentElement;
  const prev = el.style.height;
  // Kurz 1 px höher, damit es überhaupt etwas zu scrollen gibt
  el.style.height = 'calc(100% + 1px)';
  win.scrollTo(0, 1);
  win.requestAnimationFrame(() => {
    win.scrollTo(0, 0);
    el.style.height = prev;
  });
}

export function installIosViewportFix(win: Win = window as unknown as Win): boolean {
  if (win.navigator.standalone !== true) return false;
  const run = () => nudgeViewport(win);
  win.addEventListener('load', run);
  win.addEventListener('pageshow', run);
  win.addEventListener('orientationchange', run);
  win.document.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState === 'visible') run();
  });
  return true;
}

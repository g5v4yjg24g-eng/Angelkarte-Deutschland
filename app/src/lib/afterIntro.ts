/** Wartet, bis das Intro (index.html) weg ist, und ruft dann `cb`; liefert die Abmeldung. */
export function afterIntro(cb: () => void): () => void {
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

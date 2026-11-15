// Knöpfe der Live Activity öffnen die App mit `fangpunkt://session/<aktion>` (die Erweiterung kann nur Links öffnen).
// Rein: aus dem geöffneten Link die Aktion lesen; alles andere wird ignoriert.
export const LIVE_ACTIONS = ['pause', 'resume', 'end', 'catch', 'review', 'open'] as const;
export type LiveLinkAction = (typeof LIVE_ACTIONS)[number];

export function liveLinkAction(raw: string): LiveLinkAction | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'fangpunkt:' || url.hostname !== 'session') return undefined;
  const action = url.pathname.replace(/^\/+|\/+$/g, '');
  return (LIVE_ACTIONS as readonly string[]).includes(action) ? (action as LiveLinkAction) : undefined;
}

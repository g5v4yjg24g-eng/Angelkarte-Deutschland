/** Ereignis: Verbindungen haben sich geändert (angenommen, beendet) – sofort abgleichen */
export const SPOTS_CHANGED = 'fangpunkt:spots-changed';
export const notifySpotsChanged = () => window.dispatchEvent(new Event(SPOTS_CHANGED));

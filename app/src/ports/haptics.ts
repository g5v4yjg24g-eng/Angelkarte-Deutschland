// Port für spürbare Rückmeldung (Vibration) – nur in der iPhone-App (Weg 1 „wie eine echte App“, Freigabe Nutzer
// 2026-11-06). Im Browser ist `available` false und alle Aufrufe tun nichts.
export interface HapticsProvider {
  available: boolean;
  /** Etwas wurde gespeichert (z. B. Fang) */
  success(): void;
  /** Leichter Stoß (z. B. „Gefällt mir“) */
  light(): void;
  /** Auswahl beginnt / wechselt / endet (z. B. Wischen über die Leiste) */
  selectionStart(): void;
  selectionChanged(): void;
  selectionEnd(): void;
}

const noop = () => undefined;
export const NO_HAPTICS: HapticsProvider = {
  available: false,
  success: noop,
  light: noop,
  selectionStart: noop,
  selectionChanged: noop,
  selectionEnd: noop,
};

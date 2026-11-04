// Port für Push-Mitteilungen des Geräts (nur in der iPhone-App). Im Browser ist `available` false.
import type { PushPermission } from '../domain/push';

export interface PushProvider {
  available: boolean;
  permission(): Promise<PushPermission>;
  /** Erlaubnis erfragen (System-Dialog) */
  requestPermission(): Promise<PushPermission>;
  /** beim Betriebssystem anmelden; liefert das Geräte-Token */
  register(): Promise<string>;
  /** Mitteilung angetippt – `data` ist der Inhalt neben dem Text */
  onTap(listener: (data: unknown) => void): () => void;
}

/** zuletzt beim Server angemeldetes Token (zum Abmelden beim Konto-Abmelden) */
export const PUSH_TOKEN_KEY = 'fangpunkt.pushToken';

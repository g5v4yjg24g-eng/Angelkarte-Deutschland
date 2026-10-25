// Port für das freiwillige Nutzerkonto. Features kennen nur diese Schnittstelle, nicht den Anbieter.
import type { Profile } from '../domain/account';

export interface AccountUser {
  id: string;
  email: string;
}

export class AccountError extends Error {
  override name = 'AccountError';
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface AccountProvider {
  /** false, wenn nicht eingerichtet – dann zeigt die App keine Anmeldung an */
  enabled: boolean;
  /** Anbieter-Host (für die Datenschutzseite) */
  host?: string | undefined;
  /** gespeicherte Anmeldung lesen (ohne Netz, wenn keine vorhanden) */
  currentUser(): Promise<AccountUser | null>;
  onChange(listener: (user: AccountUser | null) => void): () => void;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<AccountUser>;
  signOut(): Promise<void>;
  getProfile(): Promise<Profile | null>;
  usernameAvailable(username: string): Promise<boolean>;
  createProfile(username: string, displayName: string): Promise<Profile>;
  updateDisplayName(displayName: string): Promise<Profile>;
  /** Konto und Profil endgültig löschen, danach abgemeldet */
  deleteAccount(): Promise<void>;
}

/** Ob auf diesem Gerät eine Anmeldung gespeichert ist – ohne den Anbieter zu laden (für die Mehr-Liste). */
export const ACCOUNT_STORAGE_KEY = 'fangpunkt.auth';

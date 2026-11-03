// Port für das freiwillige Nutzerkonto. Features kennen nur diese Schnittstelle, nicht den Anbieter.
import type { Profile } from '../domain/account';
import type { Badge } from '../domain/badges';
import type { FriendEntry, FriendRequestResult } from '../domain/friends';
import type { FeedPost } from '../domain/feed';

export interface AccountUser {
  id: string;
  email: string;
}

/** Beitrag zum Teilen (Etappe 2): Fotos so, wie sie auf dem Gerät liegen (EXIF schon entfernt) */
export interface SharedPostInput {
  id: string;
  caption?: string | undefined;
  visibility: 'friends' | 'public';
  createdAt: string;
  photos: { blob: Blob; mime: string }[];
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
  /** Abzeichen des angemeldeten Kontos – nur vom Server vergeben (Tabelle user_badges) */
  myBadges(): Promise<Badge[]>;
  /** Freunde und offene Anfragen (Server-Funktion my_friends) */
  friends(): Promise<FriendEntry[]>;
  /** Anfrage per Nutzername; hat der andere schon angefragt, sind beide sofort befreundet */
  sendFriendRequest(username: string): Promise<FriendRequestResult>;
  respondFriendRequest(requestId: string, accept: boolean): Promise<void>;
  /** Freundschaft beenden oder eigene Anfrage zurückziehen */
  removeFriend(userId: string): Promise<void>;
  /** Beitrag mit Fotos hochladen (ersetzt einen früheren Stand derselben ID) */
  publishPost(post: SharedPostInput): Promise<void>;
  updateSharedPost(
    id: string,
    changes: { caption?: string | undefined; visibility: 'friends' | 'public' },
  ): Promise<void>;
  /** Beitrag samt Fotos vom Server entfernen (fehlt er schon, ist das kein Fehler) */
  deleteSharedPost(id: string): Promise<void>;
  /** Feed: eigene Beiträge und die von Freunden, neueste zuerst; `before` = Zeit des letzten geladenen Beitrags */
  feed(before?: string): Promise<FeedPost[]>;
  /** Konto und Profil endgültig löschen, danach abgemeldet */
  deleteAccount(): Promise<void>;
}

/** Ob auf diesem Gerät eine Anmeldung gespeichert ist – ohne den Anbieter zu laden (für die Mehr-Liste). */
export const ACCOUNT_STORAGE_KEY = 'fangpunkt.auth';
/** Zuletzt vom Server gelesene Abzeichen (nur zur Anzeige ohne Netz, siehe domain/badges.ts) */
export const BADGE_STORAGE_KEY = 'fangpunkt.badges';

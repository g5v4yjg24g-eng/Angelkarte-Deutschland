// Port für das freiwillige Nutzerkonto. Features kennen nur diese Schnittstelle, nicht den Anbieter.
import type { Profile } from '../domain/account';
import type { Badge } from '../domain/badges';
import type { FriendEntry, FriendRequestResult } from '../domain/friends';
import type { GroupMember, GroupSession } from '../domain/groupSessions';
import type { FeedPost } from '../domain/feed';
import type { SharedSpot, ShareSpotInput } from '../domain/sharedSpots';
import type { BlockedUser, ReportInput } from '../domain/moderation';
import type { ServerComment, ServerReactions } from '../domain/reactions';
import type { PushPrefs } from '../domain/push';
import type {
  BanDuration,
  ModContent,
  ModLogEntry,
  ModReport,
  ModUser,
  ModUserItem,
} from '../domain/modAdmin';

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
  speciesId?: string | undefined;
  lengthCm?: number | undefined;
  /** Highlight einer gemeinsamen Session (Paket 8b) */
  groupId?: string | undefined;
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
    changes: {
      caption?: string | undefined;
      visibility: 'friends' | 'public';
      speciesId?: string | undefined;
      lengthCm?: number | undefined;
    },
  ): Promise<void>;
  /** Beitrag samt Fotos vom Server entfernen (fehlt er schon, ist das kein Fehler) */
  deleteSharedPost(id: string): Promise<void>;
  /** Feed: eigene Beiträge und die von Freunden, neueste zuerst; `before` = Zeit des letzten geladenen Beitrags */
  feed(before?: string): Promise<FeedPost[]>;
  /** Lesezeichen (Paket 7b): umschalten (neuer Stand), welche gespeichert sind, gespeicherte Beiträge */
  toggleSave(postId: string): Promise<boolean>;
  savedIds(postIds: string[]): Promise<Set<string>>;
  savedPosts(before?: string): Promise<FeedPost[]>;
  /** Gemeinsame Sessions (Paket 8a): anlegen (Gastgeber ist dabei), liefert die ID */
  createGroupSession(input: { title?: string | undefined; waterName?: string | undefined }): Promise<string>;
  /** Freunde einladen (nur Gastgeber); liefert die Zahl neu Eingeladener */
  inviteToGroupSession(groupId: string, userIds: string[]): Promise<number>;
  respondGroupInvite(groupId: string, accept: boolean): Promise<void>;
  leaveGroupSession(groupId: string): Promise<void>;
  /** nur Gastgeber */
  endGroupSession(groupId: string): Promise<void>;
  myGroupSessions(): Promise<GroupSession[]>;
  groupSessionMembers(groupId: string): Promise<GroupMember[]>;
  /** Highlights einer gemeinsamen Session (Paket 8b), neueste zuerst; `before` = createdAt */
  groupHighlights(groupId: string, before?: string): Promise<FeedPost[]>;
  /** Entdecken (Paket 7c): Beiträge mit „Alle“ von anderen Konten, zuletzt geteilt zuerst; `before` = sharedAt */
  discoverFeed(before?: string): Promise<FeedPost[]>;
  /** Geteilte Spots: eigene Freigaben und die von Freunden (Server-Funktion my_shared_spots) */
  sharedSpots(): Promise<SharedSpot[]>;
  /** Ort teilen; derselbe Ort an denselben Empfänger erneut = Stand aktualisieren */
  shareSpot(input: ShareSpotInput): Promise<void>;
  unshareSpot(id: string): Promise<void>;
  /** Inhalt oder Konto melden (Server-Funktion report_content, Mail an moderation@fangpunkt.com) */
  report(input: ReportInput): Promise<void>;
  /** Blockieren beendet die Freundschaft und blendet beide gegenseitig aus */
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;
  blockedUsers(): Promise<BlockedUser[]>;
  /** „Gefällt mir“ und Kommentarzahl für mehrere geteilte Beiträge (fehlt einer, ist er nicht sichtbar) */
  postReactions(postIds: string[]): Promise<Map<string, ServerReactions>>;
  /** „Gefällt mir“ umschalten; liefert den neuen Stand */
  toggleLike(postId: string): Promise<boolean>;
  postComments(postId: string): Promise<ServerComment[]>;
  addComment(postId: string, text: string): Promise<void>;
  deleteComment(commentId: string): Promise<void>;
  /** Push-Mitteilungen: Geräte-Token beim Konto an- und abmelden, Arten ein-/ausschalten */
  registerPushDevice(token: string): Promise<void>;
  unregisterPushDevice(token: string): Promise<void>;
  pushPrefs(): Promise<PushPrefs>;
  setPushPrefs(prefs: PushPrefs): Promise<void>;
  /** Moderationsbereich (nur Moderatoren; der Server prüft jede Anfrage selbst) */
  isModerator(): Promise<boolean>;
  modReports(state: 'open' | 'done' | 'all'): Promise<ModReport[]>;
  modContent(kind: 'post' | 'comment' | 'spot', id: string): Promise<ModContent | undefined>;
  modUser(userId: string): Promise<ModUser | undefined>;
  modUserContent(userId: string): Promise<ModUserItem[]>;
  modUserLog(userId: string): Promise<ModLogEntry[]>;
  /** zeitlich begrenzte Adressen für Fotos (Moderatoren sehen alle) */
  modPhotoUrls(paths: string[]): Promise<string[]>;
  /** Inhalt löschen; Fotos eines Beitrags werden vorher aus dem Speicher entfernt */
  modDeleteContent(
    kind: 'post' | 'comment' | 'spot',
    id: string,
    photoPaths: string[],
    reportId?: string,
    note?: string,
  ): Promise<void>;
  modWarn(userId: string, note: string, reportId?: string): Promise<void>;
  modResolve(reportId: string, note?: string): Promise<void>;
  modBan(userId: string, days: BanDuration, reason: string, reportId?: string): Promise<void>;
  modUnban(userId: string, note?: string): Promise<void>;
  /**
   * Eigenes Profilbild auf dem Server setzen (JPEG, quadratisch) oder mit null entfernen. Das alte Bild bleibt, bis
   * das neue eingetragen ist; danach wird es gelöscht. Fehler 'no_profile', wenn es noch kein Server-Profil gibt.
   */
  publishAvatar(photo: Blob | null): Promise<void>;
  /** Adressen der Profilbilder (1 h gültig); fehlt ein Konto, hat es keins oder ist nicht sichtbar */
  avatarUrls(userIds: string[]): Promise<Map<string, string>>;
  /** Moderation: Profilbild eines Kontos entfernen (Eintrag und Datei) */
  modClearAvatar(userId: string, reportId?: string, note?: string): Promise<void>;
  /** Konto und Profil endgültig löschen, danach abgemeldet */
  deleteAccount(): Promise<void>;
}

/** Ob auf diesem Gerät eine Anmeldung gespeichert ist – ohne den Anbieter zu laden (für die Mehr-Liste). */
export const ACCOUNT_STORAGE_KEY = 'fangpunkt.auth';
/** Zuletzt vom Server gelesene Abzeichen (nur zur Anzeige ohne Netz, siehe domain/badges.ts) */
export const BADGE_STORAGE_KEY = 'fangpunkt.badges';

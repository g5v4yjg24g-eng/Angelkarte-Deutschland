// Port für das freiwillige Nutzerkonto. Features kennen nur diese Schnittstelle, nicht den Anbieter.
import type { Profile } from '../domain/account';
import type { Badge } from '../domain/badges';
import type { FriendEntry, FriendRequestResult } from '../domain/friends';
import type { GroupMember, GroupSession } from '../domain/groupSessions';
import type { FeedPost } from '../domain/feed';
import type { ProfileExtrasPayload, PublicProfile, UserHit } from '../domain/userProfile';
import type { SharedSpot, ShareSpotInput } from '../domain/sharedSpots';
import type { BlockedUser, ReportInput } from '../domain/moderation';
import type { ServerComment, ServerReactions } from '../domain/reactions';
import type { PushPrefs, PushStatus } from '../domain/push';
import type { PostVisibility } from '../domain/schemas';
import type {
  BanDuration,
  ModContent,
  ModLogEntry,
  ModOverview,
  ModPostState,
  ModReport,
  ModReporter,
  ModReportStatus,
  ModUser,
  ModUserFilter,
  ModUserItem,
  ModUserRow,
  ModWarning,
} from '../domain/modAdmin';

export interface AccountUser {
  id: string;
  email: string;
  /** Passwort schon festgelegt? Konten aus der Zeit der Code-Anmeldung haben noch keins (Hinweis in der App) */
  hasPassword?: boolean;
  /** Angefragte neue E-Mail-Adresse, solange sie noch nicht an beiden Adressen bestätigt ist */
  newEmail?: string;
}

/** Beitrag zum Teilen (Etappe 2): Fotos so, wie sie auf dem Gerät liegen (EXIF schon entfernt) */
export interface SharedPostInput {
  id: string;
  caption?: string | undefined;
  visibility: PostVisibility;
  createdAt: string;
  /** Fotos samt Vorschaubild (320 px); schon im Speicher vorhandene werden nicht erneut hochgeladen */
  photos: { blob: Blob; mime: string; thumb?: Blob | undefined }[];
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
  /** Anmelden mit E-Mail und Passwort (seit 2026-11-10 der einzige Weg) */
  signIn(email: string, password: string): Promise<AccountUser>;
  /** Registrieren: Bestätigungsmail mit Link und Code (10 min); erst danach ist das Konto aktiv */
  signUp(email: string, password: string): Promise<void>;
  /** Registrierung mit dem Code aus der Mail bestätigen (meldet an) */
  confirmSignUp(email: string, code: string): Promise<AccountUser>;
  resendConfirmation(email: string): Promise<void>;
  /** „Passwort vergessen?“: Mail mit Link und Code (10 min) – meldet nie, ob es die Adresse gibt */
  requestPasswordReset(email: string): Promise<void>;
  /** Code aus der Passwort-Mail eingeben (meldet für das Neusetzen an) */
  confirmPasswordReset(email: string, code: string): Promise<AccountUser>;
  /** Passwort festlegen oder ändern (angemeldet); andere Geräte werden danach abgemeldet */
  setPassword(password: string): Promise<void>;
  /** Passwort erneut prüfen (vor heiklen Schritten) – false bei falschem Passwort */
  verifyPassword(password: string): Promise<boolean>;
  /** E-Mail-Adresse ändern: Bestätigung per Link an alte und neue Adresse */
  changeEmail(newEmail: string): Promise<void>;
  /** Auf allen anderen Geräten abmelden */
  signOutOthers(): Promise<void>;
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
  /**
   * Beitrag mit Fotos veröffentlichen (Server-Funktion publish_post): legt höchstens einmal an, erneut aufgerufen
   * wird nur der Stand nachgezogen. Danach wird geprüft, dass das erste Foto abrufbar ist.
   */
  publishPost(post: SharedPostInput): Promise<void>;
  /**
   * Eigene Fotos eines Beitrags aus dem Speicher holen (Profil auf einem weiteren Gerät), mit Vorschaubild, falls
   * vorhanden. Fehlt ein Foto, `undefined`.
   */
  downloadPostPhotos(paths: string[]): Promise<{ blob: Blob; thumb?: Blob | undefined }[] | undefined>;
  updateSharedPost(
    id: string,
    changes: {
      caption?: string | undefined;
      visibility: PostVisibility;
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
  /** Paket 12: freiwillige Angaben des eigenen Profils für Freunde (Server prüft und filtert Highlights) */
  setProfileExtras(payload: ProfileExtrasPayload): Promise<void>;
  /** Profil einer Person per Nutzername; null = nicht gefunden, blockiert oder gesperrt */
  userProfile(username: string): Promise<PublicProfile | null>;
  /** Beiträge einer Person, die man sehen darf, neueste zuerst; `before` = createdAt; `onlyIds` = nur diese */
  userPosts(userId: string, before?: string, onlyIds?: string[]): Promise<FeedPost[]>;
  /** Nutzer suchen (ab 3 Zeichen, höchstens 20 Treffer) */
  searchUsers(term: string): Promise<UserHit[]>;
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
  /** Test-Mitteilung an sich selbst; liefert die Zahl angemeldeter Geräte (0 = nichts verschickt) */
  sendTestPush(): Promise<number>;
  /** Geräte und Ergebnis des letzten Tests (my_push_status) */
  pushStatus(): Promise<PushStatus>;
  /** Moderationsbereich (nur Moderatoren; der Server prüft jede Anfrage selbst) */
  isModerator(): Promise<boolean>;
  /** Meldungen nach Stand (mod_reports2; ohne die meldende Person) */
  modReports(state: ModReportStatus | 'all'): Promise<ModReport[]>;
  /** Stand einer Meldung setzen (in Bearbeitung, wieder offen, erledigt) – wird protokolliert */
  modSetReportStatus(reportId: string, status: ModReportStatus, note?: string): Promise<void>;
  /** Meldende Person einer Meldung – nur auf Anfrage, die Anfrage wird protokolliert */
  modReportReporter(reportId: string): Promise<ModReporter | undefined>;
  /** Verlauf einer Meldung (Protokoll), älteste zuerst */
  modReportLog(reportId: string): Promise<ModLogEntry[]>;
  /** Beitrag ausblenden (Grund Pflicht) bzw. wiederherstellen; ausgeblendet sieht ihn nur noch der Verfasser */
  modHidePost(postId: string, reportId: string | undefined, reason: string): Promise<void>;
  modRestorePost(postId: string, reportId: string | undefined, note?: string): Promise<void>;
  /** Stand eines Beitrags (ausgeblendet?); undefined = Beitrag gibt es nicht (mehr) */
  modPostState(postId: string): Promise<ModPostState | undefined>;
  /** Kennzahlen der Admin-Übersicht (mod_overview); fehlt die Funktion noch, nur die offenen Meldungen */
  modOverview(): Promise<ModOverview>;
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
  /** Verwarnen (Grund Pflicht, Mail an die Person); optional mit Bezug zu Meldung oder Beitrag */
  modAddWarning(userId: string, reason: string, reportId?: string, postId?: string): Promise<void>;
  /** Verwarnung zurücknehmen (bleibt im Verlauf, keine Mail) */
  modRevokeWarning(warningId: string, note?: string): Promise<void>;
  modUserWarnings(userId: string): Promise<ModWarning[]>;
  /**
   * Konten suchen bzw. auflisten (mod_users): leer = alle, Nutzer-ID, Namensteil oder – nur Founder – E-Mail exakt.
   * 50 je Seite, neueste zuerst; `before` = Registrierungsdatum des letzten Eintrags der vorigen Seite.
   */
  modUsers(query: string, filter: ModUserFilter, before?: string): Promise<ModUserRow[]>;
  /** Darf dieses Konto per E-Mail suchen? (nur Anzeige; der Server prüft selbst) */
  modCanSearchEmail(): Promise<boolean>;
  modResolve(reportId: string, note?: string): Promise<void>;
  /**
   * Einmalige Hinweis-Mail „Anmeldung jetzt mit Passwort“ an Konten ohne Passwort (Edge Function password-notice,
   * nur Moderatoren). `send: false` zählt nur.
   */
  modPasswordNotice(send: boolean): Promise<{ pending: number; sent: number; failed: number }>;
  /** Sperren; dauerhaft nur nach frischer Passwort-Anmeldung (vorher verifyPassword, sonst Fehler reauth_required) */
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
  /** Paket 12: Profiltext und Angaben einer Person (nur Moderatoren) und entfernen */
  modProfileText(userId: string): Promise<{ bio?: string | undefined; facts: string[] } | undefined>;
  modClearProfile(userId: string, note?: string): Promise<void>;
  /** Konto und Profil endgültig löschen, danach abgemeldet */
  deleteAccount(): Promise<void>;
}

/** Ob auf diesem Gerät eine Anmeldung gespeichert ist – ohne den Anbieter zu laden (für die Mehr-Liste). */
export const ACCOUNT_STORAGE_KEY = 'fangpunkt.auth';
/** Zuletzt vom Server gelesene Abzeichen (nur zur Anzeige ohne Netz, siehe domain/badges.ts) */
export const BADGE_STORAGE_KEY = 'fangpunkt.badges';

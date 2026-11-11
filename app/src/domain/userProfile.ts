// Profile anderer Personen und Nutzersuche (Paket 12, Masterprompt 5.1/6.1). Rein, ohne Netz.
// Der Server liefert die freiwilligen Angaben nur an bestätigte Follower (Funktion user_profile_v2, Paket C);
// hier wird nur geprüft und umgeformt – Sichtbarkeit entscheidet allein der Server.
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';
import { MethodSchema, type Post, type Profile } from './schemas';
import { STATE_CODES, type StateCode } from './water';

/** Eigene Beziehung zur Person: ich folge (bestätigt), habe angefragt oder nichts */
export type Relation = 'self' | 'following' | 'requested' | 'none';
const RelationSchema = z.enum(['self', 'following', 'requested', 'none']);

export interface PublicProfile {
  userId: string;
  username: string;
  displayName: string;
  badges: Badge[];
  relation: Relation;
  /** folgt mir (bestätigt) */
  followsMe: boolean;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  bio?: string | undefined;
  targetSpecies: string[];
  methods: z.infer<typeof MethodSchema>[];
  region?: StateCode | undefined;
  highlightPostIds: string[];
}

export interface UserHit {
  userId: string;
  username: string;
  displayName: string;
  badges: Badge[];
  relation: Relation;
  followsMe: boolean;
}

/** Mindestlänge der Suche (gleich wie auf dem Server) */
export const SEARCH_MIN = 3;
export const SEARCH_MAX = 40;

const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((xs) =>
      (xs ?? []).flatMap((x) => {
        const p = item.safeParse(x);
        return p.success ? [p.data as z.infer<T>] : [];
      }),
    );

const ProfileRow = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  badges: z.array(z.unknown()).nullable().optional(),
  relation: RelationSchema,
  follows_me: z.boolean().nullable().optional(),
  is_private: z.boolean().nullable().optional(),
  follower_count: z.number().int().nonnegative().nullable().optional(),
  following_count: z.number().int().nonnegative().nullable().optional(),
  bio: z.string().nullable().optional(),
  target_species: list(z.string().regex(/^[a-z][a-z0-9_]{1,39}$/)),
  methods: list(MethodSchema),
  region: z.string().nullable().optional(),
  highlight_post_ids: list(z.string()),
});

export function parseUserProfile(rows: readonly unknown[] | null | undefined): PublicProfile | null {
  const p = ProfileRow.safeParse(rows?.[0]);
  if (!p.success) return null;
  const d = p.data;
  const region = STATE_CODES.find((c) => c === d.region);
  return {
    userId: d.user_id,
    username: d.username,
    displayName: d.display_name,
    badges: parseBadges((d.badges ?? []).map((badge) => ({ badge }))),
    relation: d.relation,
    followsMe: d.follows_me === true,
    isPrivate: d.is_private !== false,
    followerCount: d.follower_count ?? 0,
    followingCount: d.following_count ?? 0,
    bio: d.bio || undefined,
    targetSpecies: d.target_species.slice(0, 5),
    methods: d.methods.slice(0, 5),
    region,
    highlightPostIds: d.highlight_post_ids.slice(0, 3),
  };
}

const HitRow = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  badges: z.array(z.unknown()).nullable().optional(),
  relation: RelationSchema,
  follows_me: z.boolean().nullable().optional(),
});

export function parseUserHits(rows: readonly unknown[] | null | undefined): UserHit[] {
  const out: UserHit[] = [];
  for (const r of rows ?? []) {
    const p = HitRow.safeParse(r);
    if (!p.success) continue;
    out.push({
      userId: p.data.user_id,
      username: p.data.username,
      displayName: p.data.display_name,
      badges: parseBadges((p.data.badges ?? []).map((badge) => ({ badge }))),
      relation: p.data.relation,
      followsMe: p.data.follows_me === true,
    });
  }
  return out;
}

/** Suchbegriff bereinigen; undefined = zu kurz oder zu lang (dann nicht fragen) */
export function searchTerm(raw: string): string | undefined {
  const t = raw.trim().toLowerCase();
  return t.length >= SEARCH_MIN && t.length <= SEARCH_MAX ? t : undefined;
}

/** Was vom eigenen Profil auf den Server geht (nur die freiwilligen Angaben; Highlights nur geteilte Beiträge) */
export interface ProfileExtrasPayload {
  bio: string | null;
  targetSpecies: string[];
  methods: string[];
  region: string | null;
  highlightPostIds: string[];
}

export function extrasPayload(
  profile: Pick<Profile, 'bio' | 'targetSpecies' | 'methods' | 'region' | 'highlightPostIds'>,
  posts: readonly Pick<Post, 'id' | 'share' | 'deletedAt'>[],
): ProfileExtrasPayload {
  const shared = new Set(posts.filter((p) => p.share === 'shared' && !p.deletedAt).map((p) => p.id));
  return {
    bio: profile.bio?.trim() || null,
    targetSpecies: [...(profile.targetSpecies ?? [])],
    methods: [...(profile.methods ?? [])],
    region: profile.region ?? null,
    highlightPostIds: (profile.highlightPostIds ?? []).filter((id) => shared.has(id)),
  };
}

/** Schlüssel für „schon so auf dem Server“ (je Konto) */
export function extrasKey(userId: string, payload: ProfileExtrasPayload): string {
  return JSON.stringify([userId, payload]);
}

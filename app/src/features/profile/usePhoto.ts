import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { PROFILE_ID, type Photo, type Post, type Profile } from '../../domain/schemas';
import { listPosts } from '../../data/profileService';

/** Eigenes Profil; undefined = lädt noch, null = noch nicht angelegt */
export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => {
    const p = await getDb().profiles.get(PROFILE_ID);
    return p && !p.deletedAt ? p : null;
  }, []);
}

export const usePosts = (): Post[] | undefined => useLiveQuery(() => listPosts(), []);

export function usePhotos(ids: readonly string[] | undefined): Photo[] | undefined {
  return useLiveQuery(
    async () => (ids?.length ? (await getDb().photos.bulkGet([...ids])).filter((p): p is Photo => !!p) : []),
    [ids?.join(',')],
  );
}

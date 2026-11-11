// Rückmeldung nach „Folgen“ (Paket C) – gemeinsam für die Follower-Seite und Profile anderer
import { de } from '../../i18n/de';
import type { FollowResult } from '../../domain/follows';

const t = de.friends;

export const followMessage = (r: FollowResult, u: string) =>
  r === 'requested' ? t.requestedMsg(u) : r === 'following' ? t.followingMsg(u) : t.already(u);

/** Who may follow a player. `following` means only the players they follow themselves. */
export const FOLLOW_POLICIES = ['everyone', 'following', 'nobody'] as const;
export type FollowPolicy = (typeof FOLLOW_POLICIES)[number];

/**
 * What the bell tells a player besides challenges and games: a new follower, and what moderation decided about
 * them (`renamed`, `profileCleared`, `gameVoided`, the study ones, `suspensionLifted`) or about a report they sent
 * (`reportClosed`).
 */
export const NOTICE_KINDS = [
  'follow',
  'reportClosed',
  'renamed',
  'profileCleared',
  'gameVoided',
  'studyHidden',
  'studyRestored',
  'studyDeleted',
  'suspensionLifted',
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export interface NoticeView {
  readonly id: number;
  readonly kind: NoticeKind;
  /** `follow`: the follower, by their current name. Moderators are never named. */
  readonly actor: string | null;
  /** The study title, the new username or the reported player, depending on the kind. */
  readonly subject: string | null;
  /** The id of the game or study the notice is about, when it still has a page. */
  readonly ref: string | null;
  readonly createdAt: number;
  readonly read: boolean;
}

/** How many notices the bell lists, newest first. */
export const NOTICES_MAX = 20;
/** How many notices are kept per player; older ones are deleted. */
export const NOTICES_KEPT = 50;

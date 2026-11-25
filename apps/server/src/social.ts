import { CHALLENGE_POLICIES, FOLLOW_POLICIES, type FollowPolicy, type ChallengePolicy, type UserRef } from '@ligungi/protocol';
import type { Db } from './db.ts';

/** Who may challenge or follow whom, blocks and follows between players. */
export class Social {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  challengePolicy(userId: string): ChallengePolicy {
    const row = this.#db.prepare('select challenge_policy from users where id = ?').get(userId) as { challenge_policy: string } | undefined;
    return CHALLENGE_POLICIES.find((policy) => policy === row?.challenge_policy) ?? 'everyone';
  }

  setChallengePolicy(userId: string, policy: ChallengePolicy): void {
    this.#db.prepare('update users set challenge_policy = ? where id = ?').run(policy, userId);
  }

  followPolicy(userId: string): FollowPolicy {
    const row = this.#db.prepare('select follow_policy from users where id = ?').get(userId) as { follow_policy: string } | undefined;
    return FOLLOW_POLICIES.find((policy) => policy === row?.follow_policy) ?? 'everyone';
  }

  setFollowPolicy(userId: string, policy: FollowPolicy): void {
    this.#db.prepare('update users set follow_policy = ? where id = ?').run(policy, userId);
  }

  /** Whether `fromId` may challenge `toId` from the profile, by `toId`'s policy. */
  canChallenge(fromId: string, toId: string): boolean {
    if (fromId === toId || this.isBlocked(fromId, toId)) return false;
    const policy = this.challengePolicy(toId);
    return policy === 'everyone' || (policy === 'following' && this.isFollowing(toId, fromId));
  }

  /** Whether `fromId` may start following `toId`, by `toId`'s policy. Followers from before a stricter policy stay. */
  canFollow(fromId: string, toId: string): boolean {
    if (fromId === toId || this.isBlocked(fromId, toId)) return false;
    const policy = this.followPolicy(toId);
    return policy === 'everyone' || (policy === 'following' && this.isFollowing(toId, fromId));
  }

  /**
   * Blocks `targetId` for `userId`: neither can challenge, follow or be paired with the other any more, and the follows
   * between them, in both directions, are removed. Returns false when the block already existed.
   */
  block(userId: string, targetId: string): boolean {
    this.#db.exec('begin');
    try {
      const result = this.#db.prepare('insert or ignore into blocks (user_id, blocked_id, created_at) values (?, ?, ?)').run(userId, targetId, this.#now());
      this.#db
        .prepare('delete from follows where (user_id = ?1 and followed_id = ?2) or (user_id = ?2 and followed_id = ?1)')
        .run(userId, targetId);
      this.#db.exec('commit');
      return result.changes > 0;
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
  }

  unblock(userId: string, targetId: string): void {
    this.#db.prepare('delete from blocks where user_id = ? and blocked_id = ?').run(userId, targetId);
  }

  /** Whether `userId` blocked `targetId` (one direction, for the blocker's own view). */
  hasBlocked(userId: string, targetId: string): boolean {
    return Boolean(this.#db.prepare('select 1 from blocks where user_id = ? and blocked_id = ?').get(userId, targetId));
  }

  /** Whether either of the two blocked the other: what keeps them apart. */
  isBlocked(a: string, b: string): boolean {
    return Boolean(
      this.#db.prepare('select 1 from blocks where (user_id = ?1 and blocked_id = ?2) or (user_id = ?2 and blocked_id = ?1)').get(a, b),
    );
  }

  blocked(userId: string): UserRef[] {
    const rows = this.#db
      .prepare(
        `select users.id, users.username from blocks join users on users.id = blocks.blocked_id
         where blocks.user_id = ? order by users.username_key`,
      )
      .all(userId) as Array<{ id: string; username: string }>;
    return rows.map((row) => ({ id: row.id, name: row.username }));
  }

  blockCount(userId: string): number {
    return (this.#db.prepare('select count(*) as n from blocks where user_id = ?').get(userId) as { n: number }).n;
  }

  /** Returns false when the follow already existed. */
  follow(userId: string, targetId: string): boolean {
    const result = this.#db
      .prepare('insert or ignore into follows (user_id, followed_id, created_at) values (?, ?, ?)')
      .run(userId, targetId, this.#now());
    return result.changes > 0;
  }

  unfollow(userId: string, targetId: string): void {
    this.#db.prepare('delete from follows where user_id = ? and followed_id = ?').run(userId, targetId);
  }

  isFollowing(userId: string, targetId: string): boolean {
    return Boolean(this.#db.prepare('select 1 from follows where user_id = ? and followed_id = ?').get(userId, targetId));
  }

  following(userId: string): UserRef[] {
    const rows = this.#db
      .prepare(
        `select users.id, users.username from follows join users on users.id = follows.followed_id
         where follows.user_id = ? order by users.username_key`,
      )
      .all(userId) as Array<{ id: string; username: string }>;
    return rows.map((row) => ({ id: row.id, name: row.username }));
  }

  followers(userId: string): UserRef[] {
    const rows = this.#db
      .prepare(
        `select users.id, users.username from follows join users on users.id = follows.user_id
         where follows.followed_id = ? order by users.username_key`,
      )
      .all(userId) as Array<{ id: string; username: string }>;
    return rows.map((row) => ({ id: row.id, name: row.username }));
  }

  followCounts(userId: string): { followers: number; following: number } {
    const row = this.#db
      .prepare(
        `select (select count(*) from follows where followed_id = ?1) as followers,
                (select count(*) from follows where user_id = ?1) as following`,
      )
      .get(userId) as { followers: number; following: number };
    return { followers: row.followers, following: row.following };
  }
}

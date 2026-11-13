import { MODES, type Mode } from '@ligungi/engine';
import { CHALLENGE_POLICIES, type ChallengePolicy, type RatingView, type UserRef } from '@ligungi/protocol';
import type { Db } from './db.ts';
import { DEFAULT_RATING, PROVISIONAL_DEVIATION, type Rating } from './glicko.ts';
import { randomId } from './ids.ts';

export interface UserRecord extends UserRef {
  readonly passwordHash: string;
  readonly createdAt: number;
}

export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/;

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.username,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
});

export interface StoredRating extends Rating {
  readonly games: number;
}

export class Users {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  create(username: string, passwordHash: string): UserRecord | undefined {
    if (this.findByName(username)) return undefined;
    const record: UserRecord = { id: randomId(12), name: username, passwordHash, createdAt: this.#now() };
    this.#db
      .prepare('insert into users (id, username, username_key, password_hash, created_at) values (?, ?, ?, ?, ?)')
      .run(record.id, username, username.toLowerCase(), passwordHash, record.createdAt);
    return record;
  }

  findByName(username: string): UserRecord | undefined {
    const row = this.#db
      .prepare('select id, username, password_hash, created_at from users where username_key = ?')
      .get(username.toLowerCase()) as UserRow | undefined;
    return row && toRecord(row);
  }

  updatePasswordHash(userId: string, passwordHash: string): void {
    this.#db.prepare('update users set password_hash = ? where id = ?').run(passwordHash, userId);
  }

  findById(id: string): UserRecord | undefined {
    const row = this.#db
      .prepare('select id, username, password_hash, created_at from users where id = ?')
      .get(id) as UserRow | undefined;
    return row && toRecord(row);
  }

  rating(userId: string, mode: Mode): StoredRating {
    const row = this.#db
      .prepare('select rating, deviation, volatility, games from ratings where user_id = ? and mode = ?')
      .get(userId, mode) as StoredRating | undefined;
    return row ? { ...row } : { ...DEFAULT_RATING, games: 0 };
  }

  saveRating(userId: string, mode: Mode, rating: StoredRating): void {
    this.#db
      .prepare(
        `insert into ratings (user_id, mode, rating, deviation, volatility, games) values (?, ?, ?, ?, ?, ?)
         on conflict (user_id, mode) do update set rating = excluded.rating, deviation = excluded.deviation,
         volatility = excluded.volatility, games = excluded.games`,
      )
      .run(userId, mode, rating.rating, rating.deviation, rating.volatility, rating.games);
  }

  /** Usernames starting with `prefix` (case-insensitive), alphabetical. */
  search(prefix: string, limit: number): UserRef[] {
    const key = prefix.toLowerCase();
    const rows = this.#db
      .prepare('select id, username from users where username_key >= ? and username_key < ? order by username_key limit ?')
      .all(key, `${key}\uffff`, limit) as Array<{ id: string; username: string }>;
    return rows.map((row) => ({ id: row.id, name: row.username }));
  }

  /** Removes the account and everything tied to it except finished games, which the caller anonymizes. */
  delete(userId: string): void {
    this.#db.exec('begin');
    try {
      this.#db.prepare('delete from follows where user_id = ? or followed_id = ?').run(userId, userId);
      this.#db.prepare('delete from ratings where user_id = ?').run(userId);
      this.#db.prepare('delete from sessions where user_id = ?').run(userId);
      this.#db.prepare('delete from users where id = ?').run(userId);
      this.#db.exec('commit');
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
  }

  challengePolicy(userId: string): ChallengePolicy {
    const row = this.#db.prepare('select challenge_policy from users where id = ?').get(userId) as { challenge_policy: string } | undefined;
    return CHALLENGE_POLICIES.find((policy) => policy === row?.challenge_policy) ?? 'everyone';
  }

  setChallengePolicy(userId: string, policy: ChallengePolicy): void {
    this.#db.prepare('update users set challenge_policy = ? where id = ?').run(policy, userId);
  }

  count(): number {
    return (this.#db.prepare('select count(*) as n from users').get() as { n: number }).n;
  }

  /** Players with rated games in `mode`, per band of `width` rating points, lowest band first. */
  ratingDistribution(mode: Mode, width: number): Array<{ from: number; players: number }> {
    const rows = this.#db
      .prepare(
        `select cast(rating / ? as integer) * ? as band, count(*) as players from ratings
         where mode = ? and games > 0 group by band order by band`,
      )
      .all(width, width, mode) as Array<{ band: number; players: number }>;
    return rows.map((row) => ({ from: row.band, players: row.players }));
  }

  /** Leaderboard position of every established player of a mode, as `rank` computes it one by one. */
  ranks(mode: Mode): Map<string, number> {
    const rows = this.#db
      .prepare(
        `select user_id, rank() over (order by rating desc) as position from ratings
         where mode = ? and games > 0 and deviation <= ?`,
      )
      .all(mode, PROVISIONAL_DEVIATION) as Array<{ user_id: string; position: number }>;
    return new Map(rows.map((row) => [row.user_id, row.position]));
  }

  /** Established players per mode, the ones on the leaderboard. */
  rankedCounts(): Record<Mode, number> {
    const rows = this.#db
      .prepare('select mode, count(*) as players from ratings where games > 0 and deviation <= ? group by mode')
      .all(PROVISIONAL_DEVIATION) as Array<{ mode: Mode; players: number }>;
    const counts = Object.fromEntries(MODES.map((mode) => [mode, 0])) as Record<Mode, number>;
    for (const row of rows) counts[row.mode] = row.players;
    return counts;
  }

  /**
   * One page of a mode's full leaderboard, in the same order as `leaderboard`, with the position `rank` gives.
   * `query` keeps names containing it; `followerId` keeps that player and the ones they follow.
   */
  rankingPage(
    mode: Mode,
    filters: { query: string; followerId: string | null },
    offset: number,
    limit: number,
  ): { rows: Array<LeaderRow & { rank: number }>; total: number } {
    const where = `where (?3 = '' or instr(username_key, ?3) > 0)
      and (?4 is null or user_id = ?4 or user_id in (select followed_id from follows where user_id = ?4))`;
    const args = [mode, PROVISIONAL_DEVIATION, filters.query.toLowerCase(), filters.followerId] as const;
    const rows = this.#db
      .prepare(`with ranked as (${RANKED}) select user_id, username, rating, games, position from ranked ${where} order by row limit ?5 offset ?6`)
      .all(...args, limit, offset) as Array<{ user_id: string; username: string; rating: number; games: number; position: number }>;
    const { total } = this.#db.prepare(`with ranked as (${RANKED}) select count(*) as total from ranked ${where}`).get(...args) as { total: number };
    return {
      rows: rows.map((row) => ({ user: { id: row.user_id, name: row.username }, rating: Math.round(row.rating), games: row.games, rank: row.position })),
      total,
    };
  }

  /** A player's position and row number (1-based, for paging) on a mode's leaderboard; null when not on it. */
  rankingPlace(userId: string, mode: Mode): { rank: number; row: number } | null {
    const place = this.#db
      .prepare(`with ranked as (${RANKED}) select position, row from ranked where user_id = ?3`)
      .get(mode, PROVISIONAL_DEVIATION, userId) as { position: number; row: number } | undefined;
    return place ? { rank: place.position, row: place.row } : null;
  }

  /** Each user's rating in every mode they have rated games in. */
  playedRatings(userIds: readonly string[]): Map<string, Array<{ mode: Mode; rating: number; provisional: boolean; games: number }>> {
    const result = new Map<string, Array<{ mode: Mode; rating: number; provisional: boolean; games: number }>>();
    if (userIds.length === 0) return result;
    // Only the number of placeholders is built here; the ids themselves are bound.
    const rows = this.#db
      .prepare(
        `select user_id, mode, rating, deviation, games from ratings
         where games > 0 and user_id in (${userIds.map(() => '?').join(', ')})`,
      )
      .all(...userIds) as Array<{ user_id: string; mode: Mode; rating: number; deviation: number; games: number }>;
    for (const row of rows) {
      const list = result.get(row.user_id) ?? [];
      list.push({ mode: row.mode, rating: Math.round(row.rating), provisional: row.deviation > PROVISIONAL_DEVIATION, games: row.games });
      result.set(row.user_id, list);
    }
    return result;
  }

  /** Whether `fromId` may challenge `toId` from the profile, by `toId`'s policy. */
  canChallenge(fromId: string, toId: string): boolean {
    if (fromId === toId) return false;
    const policy = this.challengePolicy(toId);
    return policy === 'everyone' || (policy === 'following' && this.isFollowing(toId, fromId));
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

  /** Established (non-provisional) players of a mode, best first. */
  leaderboard(mode: Mode, limit: number): LeaderRow[] {
    const rows = this.#db
      .prepare(
        `select users.id, users.username, ratings.rating, ratings.games from ratings
         join users on users.id = ratings.user_id
         where ratings.mode = ? and ratings.games > 0 and ratings.deviation <= ?
         order by ratings.rating desc, ratings.games desc, users.username_key limit ?`,
      )
      .all(mode, PROVISIONAL_DEVIATION, limit) as Array<{ id: string; username: string; rating: number; games: number }>;
    return rows.map((row) => ({ user: { id: row.id, name: row.username }, rating: Math.round(row.rating), games: row.games }));
  }

  /** Position on the leaderboard of a mode, or null when the player is not on it. */
  rank(userId: string, mode: Mode): number | null {
    const own = this.#db
      .prepare('select rating, deviation, games from ratings where user_id = ? and mode = ?')
      .get(userId, mode) as { rating: number; deviation: number; games: number } | undefined;
    if (!own || own.games === 0 || own.deviation > PROVISIONAL_DEVIATION) return null;
    const row = this.#db
      .prepare(
        `select count(*) as above from ratings
         where mode = ? and games > 0 and deviation <= ? and rating > ?`,
      )
      .get(mode, PROVISIONAL_DEVIATION, own.rating) as { above: number };
    return row.above + 1;
  }

  ratings(userId: string): Record<Mode, RatingView> {
    return Object.fromEntries(
      MODES.map((mode) => {
        const rating = this.rating(userId, mode);
        return [mode, toRatingView(rating)];
      }),
    ) as Record<Mode, RatingView>;
  }
}

/** Every established player of mode ?1 (deviation up to ?2): position as `rank` computes it and row order as `leaderboard`. */
const RANKED = `select ratings.user_id, users.username, users.username_key, ratings.rating, ratings.games,
    rank() over (order by ratings.rating desc) as position,
    row_number() over (order by ratings.rating desc, ratings.games desc, users.username_key) as row
  from ratings join users on users.id = ratings.user_id
  where ratings.mode = ?1 and ratings.games > 0 and ratings.deviation <= ?2`;

export interface LeaderRow {
  readonly user: UserRef;
  readonly rating: number;
  readonly games: number;
}

export const toRatingView = (rating: StoredRating): RatingView => ({
  rating: Math.round(rating.rating),
  deviation: Math.round(rating.deviation),
  games: rating.games,
  provisional: rating.deviation > PROVISIONAL_DEVIATION,
});

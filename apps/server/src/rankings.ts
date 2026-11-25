import { MODES, type Mode } from '@ligungi/engine';
import { DAY_MS, LEADERBOARD_ACTIVE_DAYS, toCountry, type Country, type UserRef } from '@ligungi/protocol';
import type { Db } from './db.ts';
import { PROVISIONAL_DEVIATION } from './glicko.ts';
import { PERMANENT_SUSPENSION } from './moderation.ts';

/**
 * Every established player of mode ?1 (deviation up to ?2) with a rated game since ?3: position as `rank` computes it and
 * row order as `leaderboard`.
 * Banned players (suspended for good) are left out, so a cheater does not stay on the leaderboard.
 */
const RANKED = `select ratings.user_id, users.username, users.username_key, users.country, ratings.rating, ratings.games,
    rank() over (order by ratings.rating desc) as position,
    row_number() over (order by ratings.rating desc, ratings.games desc, users.username_key) as row
  from ratings join users on users.id = ratings.user_id
  where ratings.mode = ?1 and ratings.games > 0 and ratings.deviation <= ?2 and ratings.played_at >= ?3
    and (users.suspended_until is null or users.suspended_until < ${PERMANENT_SUSPENSION})`;

export interface LeaderRow {
  readonly user: UserRef;
  readonly country: Country | null;
  readonly rating: number;
  readonly games: number;
}

/** The leaderboards: established players of each mode active lately, their positions and the rating spread. */
export class Rankings {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  /** The oldest last rated game that still keeps a player on the leaderboard. */
  #activeSince(): number {
    return this.#now() - LEADERBOARD_ACTIVE_DAYS * DAY_MS;
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
         where mode = ? and games > 0 and deviation <= ? and played_at >= ?`,
      )
      .all(mode, PROVISIONAL_DEVIATION, this.#activeSince()) as Array<{ user_id: string; position: number }>;
    return new Map(rows.map((row) => [row.user_id, row.position]));
  }

  /** Established players per mode, the ones on the leaderboard. */
  rankedCounts(): Record<Mode, number> {
    const rows = this.#db
      .prepare('select mode, count(*) as players from ratings where games > 0 and deviation <= ? and played_at >= ? group by mode')
      .all(PROVISIONAL_DEVIATION, this.#activeSince()) as Array<{ mode: Mode; players: number }>;
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
    const where = `where (?4 = '' or instr(username_key, ?4) > 0)
      and (?5 is null or user_id = ?5 or user_id in (select followed_id from follows where user_id = ?5))`;
    const args = [mode, PROVISIONAL_DEVIATION, this.#activeSince(), filters.query.toLowerCase(), filters.followerId] as const;
    const rows = this.#db
      .prepare(`with ranked as (${RANKED}) select user_id, username, country, rating, games, position from ranked ${where} order by row limit ?6 offset ?7`)
      .all(...args, limit, offset) as Array<{ user_id: string; username: string; country: string | null; rating: number; games: number; position: number }>;
    const { total } = this.#db.prepare(`with ranked as (${RANKED}) select count(*) as total from ranked ${where}`).get(...args) as { total: number };
    return {
      rows: rows.map((row) => ({
        user: { id: row.user_id, name: row.username },
        country: toCountry(row.country),
        rating: Math.round(row.rating),
        games: row.games,
        rank: row.position,
      })),
      total,
    };
  }

  /** A player's position and row number (1-based, for paging) on a mode's leaderboard; null when not on it. */
  rankingPlace(userId: string, mode: Mode): { rank: number; row: number } | null {
    const place = this.#db
      .prepare(`with ranked as (${RANKED}) select position, row from ranked where user_id = ?4`)
      .get(mode, PROVISIONAL_DEVIATION, this.#activeSince(), userId) as { position: number; row: number } | undefined;
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

  /** Established (non-provisional) players of a mode, best first. */
  leaderboard(mode: Mode, limit: number): LeaderRow[] {
    const rows = this.#db
      .prepare(
        `select users.id, users.username, users.country, ratings.rating, ratings.games from ratings
         join users on users.id = ratings.user_id
         where ratings.mode = ? and ratings.games > 0 and ratings.deviation <= ? and ratings.played_at >= ?
         order by ratings.rating desc, ratings.games desc, users.username_key limit ?`,
      )
      .all(mode, PROVISIONAL_DEVIATION, this.#activeSince(), limit) as Array<{ id: string; username: string; country: string | null; rating: number; games: number }>;
    return rows.map((row) => ({ user: { id: row.id, name: row.username }, country: toCountry(row.country), rating: Math.round(row.rating), games: row.games }));
  }

  /** Position on the leaderboard of a mode, or null when the player is not on it. */
  rank(userId: string, mode: Mode): number | null {
    const own = this.#db
      .prepare('select rating, deviation, games, played_at from ratings where user_id = ? and mode = ?')
      .get(userId, mode) as { rating: number; deviation: number; games: number; played_at: number | null } | undefined;
    const since = this.#activeSince();
    if (!own || own.games === 0 || own.deviation > PROVISIONAL_DEVIATION || (own.played_at ?? 0) < since) return null;
    const row = this.#db
      .prepare(
        `select count(*) as above from ratings
         where mode = ? and games > 0 and deviation <= ? and played_at >= ? and rating > ?`,
      )
      .get(mode, PROVISIONAL_DEVIATION, since, own.rating) as { above: number };
    return row.above + 1;
  }
}

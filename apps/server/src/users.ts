import { MODES, type Mode } from '@ligungi/engine';
import { EMPTY_PROFILE, parseProfileDetails, toCountry, type Country, type NewPlayer, type ProfileDetails, type RatingView, type UserRef } from '@ligungi/protocol';
import type { Db } from './db.ts';
import { DEFAULT_RATING, PROVISIONAL_DEVIATION, type Rating } from './glicko.ts';
import { randomId } from './ids.ts';
import { PERMANENT_SUSPENSION } from './moderation.ts';
import { Rankings } from './rankings.ts';
import { Social } from './social.ts';
import { Training } from './training.ts';

export interface UserRecord extends UserRef {
  readonly passwordHash: string;
  readonly createdAt: number;
  readonly country: Country | null;
}

/** Stored name of players without an account; the site shows a translated label instead. */
export const ANONYMOUS_NAME = 'Anonymous';

export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/;

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
  country: string | null;
}

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.username,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
  country: toCountry(row.country),
});

export interface StoredRating extends Rating {
  readonly games: number;
}

export class Users {
  readonly #db: Db;
  readonly #now: () => number;
  readonly social: Social;
  readonly rankings: Rankings;
  readonly training: Training;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
    this.social = new Social(db, now);
    this.rankings = new Rankings(db, now);
    this.training = new Training(db, now);
  }

  create(username: string, passwordHash: string): UserRecord | undefined {
    if (this.findByName(username)) return undefined;
    const record: UserRecord = { id: randomId(12), name: username, passwordHash, createdAt: this.#now(), country: null };
    this.#db
      .prepare('insert into users (id, username, username_key, password_hash, created_at) values (?, ?, ?, ?, ?)')
      .run(record.id, username, username.toLowerCase(), passwordHash, record.createdAt);
    return record;
  }

  findByName(username: string): UserRecord | undefined {
    const row = this.#db
      .prepare('select id, username, password_hash, created_at, country from users where username_key = ?')
      .get(username.toLowerCase()) as UserRow | undefined;
    return row && toRecord(row);
  }

  /**
   * A new username, also in every stored copy of the old one (games, challenges, seeks), so a name a moderator removed
   * does not live on in game histories. `false` when the name is taken.
   */
  rename(userId: string, username: string): boolean {
    const taken = this.findByName(username);
    if (taken && taken.id !== userId) return false;
    this.#db.exec('begin');
    try {
      this.#db.prepare('update users set username = ?, username_key = ? where id = ?').run(username, username.toLowerCase(), userId);
      for (const color of ['white', 'black'] as const) {
        this.#db.prepare(`update games set ${color}_name = ? where ${color}_user = ?`).run(username, userId);
      }
      this.#db.prepare('update challenges set owner_name = ? where owner_user = ?').run(username, userId);
      this.#db.prepare('update challenges set destination_name = ? where destination_user = ?').run(username, userId);
      this.#db.prepare('update seeks set owner_name = ? where owner_user = ?').run(username, userId);
      this.#db.exec('commit');
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
    return true;
  }

  updatePasswordHash(userId: string, passwordHash: string): void {
    this.#db.prepare('update users set password_hash = ? where id = ?').run(passwordHash, userId);
  }

  findById(id: string): UserRecord | undefined {
    const row = this.#db
      .prepare('select id, username, password_hash, created_at, country from users where id = ?')
      .get(id) as UserRow | undefined;
    return row && toRecord(row);
  }

  rating(userId: string, mode: Mode): StoredRating {
    const row = this.#db
      .prepare('select rating, deviation, volatility, games from ratings where user_id = ? and mode = ?')
      .get(userId, mode) as StoredRating | undefined;
    return row ? { ...row } : { ...DEFAULT_RATING, games: 0 };
  }

  /** Saves a rating; `played` marks a rated game just played, which keeps the player on the leaderboard (a voided game does not). */
  saveRating(userId: string, mode: Mode, rating: StoredRating, played = false): void {
    this.#db
      .prepare(
        `insert into ratings (user_id, mode, rating, deviation, volatility, games, played_at) values (?, ?, ?, ?, ?, ?, ?)
         on conflict (user_id, mode) do update set rating = excluded.rating, deviation = excluded.deviation,
         volatility = excluded.volatility, games = excluded.games, played_at = coalesce(excluded.played_at, ratings.played_at)`,
      )
      .run(userId, mode, rating.rating, rating.deviation, rating.volatility, rating.games, played ? this.#now() : null);
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
      this.#db.prepare('delete from blocks where user_id = ? or blocked_id = ?').run(userId, userId);
      this.#db.prepare('delete from notices where user_id = ? or actor_id = ?').run(userId, userId);
      this.#db.prepare('delete from ratings where user_id = ?').run(userId);
      this.#db.prepare('delete from sessions where user_id = ?').run(userId);
      this.#db.prepare('delete from recovery_codes where user_id = ?').run(userId);
      // Reports go with the account, made or received; the moderation log keeps its entries as the record of what was done.
      this.#db.prepare('delete from reports where reporter_id = ? or target_id = ?').run(userId, userId);
      this.#db.prepare('delete from two_factor where user_id = ?').run(userId);
      this.#db.prepare('delete from puzzle_attempts where user_id = ?').run(userId);
      this.#db.prepare('delete from puzzle_ratings where user_id = ?').run(userId);
      this.#db.prepare('delete from puzzle_runs where user_id = ?').run(userId);
      this.#db.prepare('delete from race_results where user_id = ?').run(userId);
      this.#db.prepare('delete from lesson_progress where user_id = ?').run(userId);
      this.#db.prepare('delete from practice_progress where user_id = ?').run(userId);
      this.#db.prepare('delete from game_bookmarks where user_id = ?').run(userId);
      this.#db.prepare('delete from study_likes where user_id = ?').run(userId);
      this.#db.prepare('delete from studies where owner_id = ?').run(userId);
      this.#db.prepare('delete from discord_links where user_id = ?').run(userId);
      this.#db.prepare('delete from users where id = ?').run(userId);
      this.#db.exec('commit');
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
  }

  /** Bio, country and linked profiles; read back through the same validation, so a bad stored value shows as empty. */
  details(userId: string): ProfileDetails {
    const row = this.#db.prepare('select bio, country, links from users where id = ?').get(userId) as
      | { bio: string; country: string | null; links: string }
      | undefined;
    if (!row) return EMPTY_PROFILE;
    let links: unknown = {};
    try {
      links = JSON.parse(row.links);
    } catch {}
    const parsed = parseProfileDetails({ bio: row.bio, country: toCountry(row.country), links });
    return typeof parsed === 'string' ? { ...EMPTY_PROFILE, bio: row.bio, country: toCountry(row.country) } : parsed;
  }

  setDetails(userId: string, details: ProfileDetails): void {
    this.#db
      .prepare('update users set bio = ?, country = ?, links = ? where id = ?')
      .run(details.bio, details.country, JSON.stringify(details.links), userId);
  }

  count(): number {
    return (this.#db.prepare('select count(*) as n from users').get() as { n: number }).n;
  }

  /** The newest accounts, newest first; banned ones (suspended for good) are left out. */
  newest(limit: number): NewPlayer[] {
    const rows = this.#db
      .prepare(
        `select id, username, country, created_at from users
         where suspended_until is null or suspended_until < ${PERMANENT_SUSPENSION}
         order by created_at desc, rowid desc limit ?`,
      )
      .all(limit) as Array<{ id: string; username: string; country: string | null; created_at: number }>;
    return rows.map((row) => ({ user: { id: row.id, name: row.username }, country: toCountry(row.country), joinedAt: row.created_at }));
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
export const toRatingView = (rating: StoredRating): RatingView => ({
  rating: Math.round(rating.rating),
  deviation: Math.round(rating.deviation),
  games: rating.games,
  provisional: rating.deviation > PROVISIONAL_DEVIATION,
});

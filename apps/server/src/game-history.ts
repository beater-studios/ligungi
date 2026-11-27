import { MODE_RULES, ROLES, applyMove, initialPosition, opposite, parseMove, toFen, type Color, type Mode, type Outcome, type Role } from '@ligungi/engine';
import {
  CROSSTABLE_RECENT,
  GAME_LENGTHS,
  GAME_SEARCH_PAGE,
  GAME_SEARCH_PAGES_MAX,
  HELD_GROUPS,
  INSIGHT_OPPONENTS,
  OPPONENT_BANDS,
  RATING_HISTORY_MAX,
  type ActivityGame,
  type Crosstable,
  type GameCounts,
  type GameFilters,
  type GameSearchResult,
  type GameStatus,
  type InsightsView,
  type GameSummary,
  type ModeRecord,
  type ModeStats,
  type RatingPoint,
  type SearchResult,
  type TimeControl,
  type UserRef,
} from '@ligungi/protocol';
import type { Db } from './db.ts';
import type { GameRoom, Seat } from './room.ts';

/** History filters with the opponent already resolved to a user id. */
export type HistoryFilters = Omit<GameFilters, 'vs'> & { readonly vsId?: string };

export interface GameRow {
  id: string;
  mode: Mode;
  rated: number;
  clock_initial: number | null;
  clock_increment: number | null;
  clock_byoyomi: number | null;
  clock_periods: number | null;
  first_player: Color;
  free_draft: number;
  white_session: string;
  white_user: string | null;
  white_name: string;
  white_rating: number | null;
  white_provisional: number;
  white_diff: number | null;
  black_session: string;
  black_user: string | null;
  black_name: string;
  black_rating: number | null;
  black_provisional: number;
  black_diff: number | null;
  moves: string;
  status: GameStatus;
  winner: Color | null;
  reason: string | null;
  clock_white: number | null;
  clock_black: number | null;
  clock_running: Color | null;
  days_per_move: number | null;
  deadline: number | null;
  rematch_id: string | null;
  created_at: number;
  ended_at: number | null;
  voided: number;
  /** Correspondence draft queues, `{ white, black }` as JSON; `null` when neither player has one. */
  draft_queue: string | null;
  arena_id: string | null;
}

/** A game search with its player names resolved to ids and its days to milliseconds. */
export interface SearchCriteria {
  readonly playerId?: string;
  readonly color?: Color;
  readonly vsId?: string;
  readonly mode?: Mode;
  readonly rated?: boolean;
  readonly result?: SearchResult;
  readonly reason?: Outcome['reason'];
  readonly ratingMin?: number;
  readonly ratingMax?: number;
  readonly from?: number;
  readonly to?: number;
  readonly movesMin?: number;
  readonly movesMax?: number;
}

/** One game in the account data export (`GET /api/account/export`). */
export interface GameExport {
  readonly id: string;
  readonly createdAt: string;
  readonly endedAt: string | null;
  readonly mode: Mode;
  readonly rated: boolean;
  readonly timeControl: { readonly initial: number; readonly increment: number } | null;
  readonly color: Color;
  readonly opponent: string;
  readonly result: 'win' | 'loss' | 'draw' | 'aborted' | 'ongoing';
  readonly reason: string | null;
  readonly ratingBefore: number | null;
  readonly ratingChange: number | null;
  readonly moves: readonly string[];
}

export const rowOutcome = (row: GameRow): Outcome | null => {
  if (row.status !== 'ended' || !row.reason) return null;
  return row.winner
    ? ({ winner: row.winner, reason: row.reason } as Outcome)
    : ({ winner: null, reason: row.reason } as Outcome);
};

export const seatFrom = (row: GameRow, color: Color): Seat => ({
  sessionId: row[`${color}_session`],
  userId: row[`${color}_user`],
  name: row[`${color}_name`],
  rating: row[`${color}_rating`],
  provisional: row[`${color}_provisional`] === 1,
  ratingDiff: row[`${color}_diff`],
});

/** The clock a stored game was created with: Fischer, byo-yomi, or none. */
export const timeControlOf = (row: GameRow): TimeControl | null => {
  if (row.clock_initial === null) return null;
  if (row.clock_byoyomi && row.clock_periods) return { initial: row.clock_initial, increment: 0, byoyomi: row.clock_byoyomi, periods: row.clock_periods };
  return { initial: row.clock_initial, increment: row.clock_increment ?? 0 };
};

/**
 * Finished games as stored: the history lists, counts, search, records, rating trends and statistics. A game still in
 * memory is read from its room, so an ongoing one shows as it stands.
 */
export class GameHistory {
  readonly #db: Db;
  readonly #room: (id: string) => GameRoom | undefined;

  constructor(db: Db, room: (id: string) => GameRoom | undefined) {
    this.#db = db;
    this.#room = room;
  }

  /** Games started since `since` (aborted ones excluded) and games finished overall, for the players page. */
  gameCounts(since: number): { recent: number; finished: number } {
    const recent = this.#db.prepare(`select count(*) as n from games where created_at >= ? and status != 'aborted'`).get(since) as { n: number };
    const finished = this.#db.prepare(`select count(*) as n from games where status = 'ended'`).get() as { n: number };
    return { recent: recent.n, finished: finished.n };
  }

  /** Finished games of a user, newest first, optionally filtered. */
  recentFor(userId: string, limit: number, before = Number.MAX_SAFE_INTEGER, filters: HistoryFilters = {}): GameSummary[] {
    const where = [`status != 'started'`, 'created_at < ?'];
    const params: Array<string | number> = [before];
    const side = (color: Color) => `${color}_user = ?`;
    if (filters.color) {
      where.push(side(filters.color));
      params.push(userId);
    } else {
      where.push('(white_user = ? or black_user = ?)');
      params.push(userId, userId);
    }
    if (filters.mode) {
      where.push('mode = ?');
      params.push(filters.mode);
    }
    if (filters.rated !== undefined) {
      where.push('rated = ?');
      params.push(filters.rated ? 1 : 0);
    }
    if (filters.vsId) {
      where.push('((white_user = ? and black_user = ?) or (black_user = ? and white_user = ?))');
      params.push(userId, filters.vsId, userId, filters.vsId);
    }
    const won = `((winner = 'white' and white_user = ?) or (winner = 'black' and black_user = ?))`;
    if (filters.result === 'win') {
      where.push(won);
      params.push(userId, userId);
    } else if (filters.result === 'loss') {
      where.push(`winner is not null and not ${won}`);
      params.push(userId, userId);
    } else if (filters.result === 'draw') {
      where.push(`status = 'ended' and winner is null`);
    }
    const rows = this.#db
      .prepare(`select * from games where ${where.join(' and ')} order by created_at desc limit ?`)
      .all(...params, limit) as unknown as GameRow[];
    return rows.map((row) => this.summaryOf(row));
  }

  /**
   * Every game of a user, oldest first, read straight from the table (no rooms rebuilt), for the data export.
   * Session ids are left out: they are other people's secrets too.
   */
  exportFor(userId: string): GameExport[] {
    const rows = this.#db
      .prepare('select * from games where white_user = ?1 or black_user = ?1 order by created_at')
      .all(userId) as unknown as GameRow[];
    return rows.map((row) => {
      const color: Color = row.white_user === userId ? 'white' : 'black';
      const opponent = color === 'white' ? 'black' : 'white';
      const result =
        row.status === 'started' ? 'ongoing' : row.status === 'aborted' ? 'aborted' : row.winner === null ? 'draw' : row.winner === color ? 'win' : 'loss';
      return {
        id: row.id,
        createdAt: new Date(row.created_at).toISOString(),
        endedAt: row.ended_at === null ? null : new Date(row.ended_at).toISOString(),
        mode: row.mode,
        rated: Boolean(row.rated),
        timeControl: timeControlOf(row),
        color,
        opponent: row[`${opponent}_name`],
        result,
        reason: row.reason,
        ratingBefore: row[`${color}_rating`],
        ratingChange: row[`${color}_diff`],
        moves: row.moves ? row.moves.split(' ') : [],
      };
    });
  }

  /** How many finished games a user has, rated, won, lost and drawn; with filters, among the games they match (as the history list). */
  counts(userId: string, filters: Pick<HistoryFilters, 'mode' | 'color' | 'vsId'> = {}): GameCounts {
    const where = [filters.color ? `${filters.color}_user = ?1` : '(white_user = ?1 or black_user = ?1)', `status = 'ended'`, 'voided = 0'];
    const params: Array<string | number> = [userId];
    if (filters.mode) {
      where.push('mode = ?2');
      params.push(filters.mode);
    }
    if (filters.vsId) {
      where.push(`((white_user = ?1 and black_user = ?${params.length + 1}) or (black_user = ?1 and white_user = ?${params.length + 1}))`);
      params.push(filters.vsId);
    }
    const row = this.#db
      .prepare(
        `select count(*) as games,
          sum(rated) as rated,
          sum(case when (winner = 'white' and white_user = ?1) or (winner = 'black' and black_user = ?1) then 1 else 0 end) as wins,
          sum(case when winner is not null and not ((winner = 'white' and white_user = ?1) or (winner = 'black' and black_user = ?1)) then 1 else 0 end) as losses,
          sum(case when status = 'ended' and winner is null then 1 else 0 end) as draws
         from games where ${where.join(' and ')}`,
      )
      .get(...params) as { games: number; rated: number | null; wins: number | null; losses: number | null; draws: number | null };
    return { games: row.games, rated: row.rated ?? 0, wins: row.wins ?? 0, losses: row.losses ?? 0, draws: row.draws ?? 0 };
  }

  /** The latest finished games on the site, newest first, voided ones aside. */
  recentlyFinished(limit: number): GameSummary[] {
    const rows = this.#db
      .prepare(`select * from games where status = 'ended' and voided = 0 order by ended_at desc limit ?`)
      .all(limit) as unknown as GameRow[];
    return rows.map((row) => this.summaryOf(row));
  }

  /** Rating points each user won or lost in a mode's rated games since `since` (ms), voided games aside; 0 without games. */
  ratingTrends(mode: Mode, userIds: readonly string[], since: number): Map<string, number> {
    const trends = new Map<string, number>(userIds.map((id) => [id, 0]));
    if (userIds.length === 0) return trends;
    // Only the number of placeholders is built here; the ids themselves are bound.
    const ids = userIds.map(() => '?').join(', ');
    const rows = this.#db
      .prepare(
        `select white_user, black_user, white_diff, black_diff from games
         where mode = ? and rated = 1 and status = 'ended' and voided = 0 and ended_at >= ?
           and (white_user in (${ids}) or black_user in (${ids}))`,
      )
      .all(mode, since, ...userIds, ...userIds) as Array<{ white_user: string | null; black_user: string | null; white_diff: number | null; black_diff: number | null }>;
    for (const row of rows) {
      if (row.white_user && trends.has(row.white_user)) trends.set(row.white_user, trends.get(row.white_user)! + (row.white_diff ?? 0));
      if (row.black_user && trends.has(row.black_user)) trends.set(row.black_user, trends.get(row.black_user)! + (row.black_diff ?? 0));
    }
    return trends;
  }

  /** Every finished game between two users (voided ones aside): the wins of each, the draws and the latest results. */
  crosstable(a: UserRef, b: UserRef): Crosstable {
    const rows = this.#db
      .prepare(
        `select id, winner, white_user from games
         where status = 'ended' and voided = 0 and ((white_user = ?1 and black_user = ?2) or (white_user = ?2 and black_user = ?1))
         order by created_at desc`,
      )
      .all(a.id, b.id) as Array<{ id: string; winner: Color | null; white_user: string }>;
    const wins: [number, number] = [0, 0];
    let draws = 0;
    const results = rows.map((row) => {
      if (row.winner === null) {
        draws++;
        return { id: row.id, winner: null };
      }
      const winnerId = row.winner === 'white' ? row.white_user : row.white_user === a.id ? b.id : a.id;
      const index: 0 | 1 = winnerId === a.id ? 0 : 1;
      wins[index]++;
      return { id: row.id, winner: index };
    });
    return { users: [{ id: a.id, name: a.name }, { id: b.id, name: b.name }], wins, draws, recent: results.slice(0, CROSSTABLE_RECENT).reverse() };
  }

  /** Wins, draws and losses of a user's finished rated games, per mode. */
  records(userId: string): Record<Mode, ModeRecord> {
    const rows = this.#db
      .prepare(
        `select mode,
          sum(case when (winner = 'white' and white_user = ?1) or (winner = 'black' and black_user = ?1) then 1 else 0 end) as wins,
          sum(case when winner is null then 1 else 0 end) as draws,
          sum(case when winner is not null and not ((winner = 'white' and white_user = ?1) or (winner = 'black' and black_user = ?1)) then 1 else 0 end) as losses
         from games where (white_user = ?1 or black_user = ?1) and status = 'ended' and rated = 1 and voided = 0
         group by mode`,
      )
      .all(userId) as Array<{ mode: Mode; wins: number; draws: number; losses: number }>;
    const empty = (): ModeRecord => ({ wins: 0, draws: 0, losses: 0 });
    const records: Record<Mode, ModeRecord> = { intro: empty(), beginner: empty(), intermediate: empty(), advanced: empty() };
    for (const row of rows) records[row.mode] = { wins: row.wins, draws: row.draws, losses: row.losses };
    return records;
  }

  /**
   * Every finished game matching a search, newest first, a page at a time. Player names are resolved to ids by the
   * caller; dates are milliseconds (start of `from`'s day, end of `to`'s).
   */
  search(criteria: SearchCriteria, page: number): GameSearchResult {
    const where = [`status = 'ended'`];
    const params: Array<string | number> = [];
    const add = (clause: string, ...values: Array<string | number>) => {
      where.push(clause);
      params.push(...values);
    };
    const { playerId, color, vsId } = criteria;
    if (playerId) {
      if (color) add(`${color}_user = ?`, playerId);
      else add('(white_user = ? or black_user = ?)', playerId, playerId);
      if (vsId) add('((white_user = ? and black_user = ?) or (black_user = ? and white_user = ?))', playerId, vsId, playerId, vsId);
    }
    if (criteria.mode) add('mode = ?', criteria.mode);
    if (criteria.rated !== undefined) add('rated = ?', criteria.rated ? 1 : 0);
    if (criteria.reason) add('reason = ?', criteria.reason);
    const { result } = criteria;
    if (result === 'white' || result === 'black') add('winner = ?', result);
    else if (result === 'draw') where.push('winner is null');
    else if (result && playerId) {
      const won = `((winner = 'white' and white_user = ?) or (winner = 'black' and black_user = ?))`;
      add(result === 'win' ? won : `winner is not null and not ${won}`, playerId, playerId);
    }
    if (criteria.ratingMin !== undefined || criteria.ratingMax !== undefined) {
      where.push('white_rating is not null and black_rating is not null');
      if (criteria.ratingMin !== undefined) add('(white_rating + black_rating) / 2.0 >= ?', criteria.ratingMin);
      if (criteria.ratingMax !== undefined) add('(white_rating + black_rating) / 2.0 <= ?', criteria.ratingMax);
    }
    if (criteria.from !== undefined) add('created_at >= ?', criteria.from);
    if (criteria.to !== undefined) add('created_at < ?', criteria.to);
    const plies = `(case when moves = '' then 0 else length(moves) - length(replace(moves, ' ', '')) + 1 end)`;
    if (criteria.movesMin !== undefined) add(`${plies} >= ?`, criteria.movesMin);
    if (criteria.movesMax !== undefined) add(`${plies} <= ?`, criteria.movesMax);
    const rows = this.#db
      .prepare(`select * from games where ${where.join(' and ')} order by created_at desc, id limit ? offset ?`)
      .all(...params, GAME_SEARCH_PAGE + 1, (page - 1) * GAME_SEARCH_PAGE) as unknown as GameRow[];
    return {
      games: rows.slice(0, GAME_SEARCH_PAGE).map((row) => this.summaryOf(row)),
      more: rows.length > GAME_SEARCH_PAGE && page < GAME_SEARCH_PAGES_MAX,
    };
  }

  /** Finished games of some players since a moment, newest first, each from its player's side (activity and feed). */
  activityGames(userIds: readonly string[], since: number, limit: number): Array<{ userId: string; at: number; game: ActivityGame }> {
    if (userIds.length === 0) return [];
    const marks = userIds.map(() => '?').join(', ');
    const rows = this.#db
      .prepare(
        `select id, mode, rated, white_user, white_name, white_diff, black_user, black_name, black_diff, winner, reason,
           coalesce(ended_at, created_at) as at
         from games
         where status = 'ended' and voided = 0 and coalesce(ended_at, created_at) >= ? and (white_user in (${marks}) or black_user in (${marks}))
         order by at desc limit ?`,
      )
      .all(since, ...userIds, ...userIds, limit) as Array<{
      id: string;
      mode: Mode;
      rated: number;
      white_user: string | null;
      white_name: string;
      white_diff: number | null;
      black_user: string | null;
      black_name: string;
      black_diff: number | null;
      winner: Color | null;
      reason: Outcome['reason'];
      at: number;
    }>;
    const wanted = new Set(userIds);
    return rows.flatMap((row) =>
      (['white', 'black'] as const)
        .filter((color) => row[`${color}_user`] !== null && wanted.has(row[`${color}_user`]!))
        .map((color) => {
          const other = opposite(color);
          const otherId = row[`${other}_user`];
          return {
            userId: row[`${color}_user`]!,
            at: row.at,
            game: {
              id: row.id,
              mode: row.mode,
              rated: row.rated === 1,
              color,
              result: row.winner === null ? 'draw' : row.winner === color ? 'win' : 'loss',
              reason: row.reason,
              ratingDiff: row[`${color}_diff`],
              opponent: { name: row[`${other}_name`], user: otherId ? { id: otherId, name: row[`${other}_name`] } : null },
            } satisfies ActivityGame,
          };
        }),
    );
  }

  /** The rated games of a player in one mode looked at from several sides; see `InsightsView`. */
  insights(userId: string, mode: Mode): InsightsView {
    const rows = this.#db
      .prepare(
        `select white_user, white_name, white_rating, black_user, black_name, black_rating, winner, reason, board_moves,
           clock_initial, days_per_move, moves, first_player, free_draft
         from games
         where (white_user = ?1 or black_user = ?1) and mode = ?2 and rated = 1 and status = 'ended' and voided = 0
         order by coalesce(ended_at, created_at) desc limit ?3`,
      )
      .all(userId, mode, RATING_HISTORY_MAX) as Array<{
      white_user: string | null;
      white_name: string;
      white_rating: number | null;
      black_user: string | null;
      black_name: string;
      black_rating: number | null;
      winner: Color | null;
      reason: Outcome['reason'];
      board_moves: number | null;
      clock_initial: number | null;
      days_per_move: number | null;
      moves: string;
      first_player: Color;
      free_draft: number;
    }>;
    const empty = (): { wins: number; draws: number; losses: number } => ({ wins: 0, draws: 0, losses: 0 });
    const byOpponent = OPPONENT_BANDS.map(empty);
    const byPace = { clock: empty(), none: empty(), correspondence: empty() };
    const endings: InsightsView['endings'] = { win: {}, draw: {}, loss: {} };
    const lengths = { win: { total: 0, count: 0 }, draw: { total: 0, count: 0 }, loss: { total: 0, count: 0 } };
    const opponents = new Map<string, { user: UserRef; record: { wins: number; draws: number; losses: number }; games: number }>();
    const drafting = MODE_RULES[mode].draft;
    const placed = new Map<Role, number>();
    const byHeld = HELD_GROUPS.map(empty);
    for (const row of rows) {
      const color: Color = row.white_user === userId ? 'white' : 'black';
      const other = opposite(color);
      const outcome = row.winner === null ? 'draw' : row.winner === color ? 'win' : 'loss';
      const key = ({ win: 'wins', draw: 'draws', loss: 'losses' } as const)[outcome];
      const mine = row[`${color}_rating`];
      const theirs = row[`${other}_rating`];
      if (mine !== null && theirs !== null) {
        const gap = theirs - mine;
        byOpponent[OPPONENT_BANDS.findIndex((upTo) => upTo === null || gap < upTo)]![key]++;
      }
      byPace[row.days_per_move ? 'correspondence' : row.clock_initial === null ? 'none' : 'clock'][key]++;
      endings[outcome][row.reason] = (endings[outcome][row.reason] ?? 0) + 1;
      if (row.board_moves !== null) {
        lengths[outcome].total += row.board_moves;
        lengths[outcome].count++;
      }
      const otherId = row[`${other}_user`];
      if (otherId) {
        const entry = opponents.get(otherId) ?? { user: { id: otherId, name: row[`${other}_name`] }, record: empty(), games: 0 };
        entry.record[key]++;
        entry.games++;
        opponents.set(otherId, entry);
      }
      if (drafting) {
        // The stored moves were checked when played, so they are applied as they are, up to the end of the draft.
        let position = initialPosition(mode, row.first_player, { freeDraft: row.free_draft === 1 });
        for (const text of row.moves ? row.moves.split(' ') : []) {
          if (position.phase !== 'draft') break;
          const move = parseMove(text);
          if (!move) break;
          if (move.kind === 'drop' && position.turn === color) placed.set(move.role, (placed.get(move.role) ?? 0) + 1);
          position = applyMove(position, move);
        }
        if (position.phase === 'play') {
          const held = ROLES.reduce((sum, role) => sum + position.hands[color][role], 0);
          byHeld[HELD_GROUPS.findIndex((upTo) => upTo === null || held <= upTo)]![key]++;
        }
      }
    }
    const average = ({ total, count }: { total: number; count: number }) => (count ? Math.round(total / count) : null);
    return {
      mode,
      games: rows.length,
      byOpponent,
      endings,
      byPace,
      length: { win: average(lengths.win), draw: average(lengths.draw), loss: average(lengths.loss) },
      opponents: [...opponents.values()]
        .sort((a, b) => b.games - a.games || a.user.name.localeCompare(b.user.name))
        .slice(0, INSIGHT_OPPONENTS)
        .map(({ user, record }) => ({ user, record })),
      draft:
        drafting && rows.length
          ? { placed: Object.fromEntries([...placed].map(([role, count]) => [role, Math.round((count / rows.length) * 10) / 10])), byHeld }
          : null,
    };
  }

  /**
   * A player's rated games in one mode: the rating after each (stored as the rating before plus the change), the peak and
   * the lowest, and the results by color and by length (moves after the draft). Voided games are left out.
   */
  modeStats(userId: string, mode: Mode): ModeStats {
    const rows = this.#db
      .prepare(
        `select id, coalesce(ended_at, created_at) as at, white_user, winner, board_moves,
           white_rating, white_diff, black_rating, black_diff
         from games
         where (white_user = ?1 or black_user = ?1) and mode = ?2 and rated = 1 and status = 'ended' and voided = 0
         order by at, id`,
      )
      .all(userId, mode) as Array<{
      id: string;
      at: number;
      white_user: string | null;
      winner: Color | null;
      board_moves: number | null;
      white_rating: number | null;
      white_diff: number | null;
      black_rating: number | null;
      black_diff: number | null;
    }>;
    const empty = (): { wins: number; draws: number; losses: number } => ({ wins: 0, draws: 0, losses: 0 });
    const byColor = { white: empty(), black: empty() };
    const byLength = GAME_LENGTHS.map(empty);
    const history: RatingPoint[] = [];
    for (const row of rows) {
      const color: Color = row.white_user === userId ? 'white' : 'black';
      const result = row.winner === null ? 'draws' : row.winner === color ? 'wins' : 'losses';
      byColor[color][result]++;
      const group = GAME_LENGTHS.findIndex((upTo) => upTo === null || (row.board_moves ?? 0) <= upTo);
      byLength[group]![result]++;
      const before = color === 'white' ? row.white_rating : row.black_rating;
      const change = color === 'white' ? row.white_diff : row.black_diff;
      if (before !== null && change !== null) history.push({ at: row.at, rating: before + change, change, gameId: row.id });
    }
    const extreme = (better: (a: number, b: number) => boolean) =>
      history.reduce<{ rating: number; at: number } | null>((best, point) => (best && !better(point.rating, best.rating) ? best : { rating: point.rating, at: point.at }), null);
    return {
      mode,
      history: history.slice(-RATING_HISTORY_MAX),
      peak: extreme((a, b) => a > b),
      lowest: extreme((a, b) => a < b),
      byColor,
      byLength,
    };
  }

  /** Results of several players' rated games in one mode, as `records` counts them. */
  recordsIn(mode: Mode, userIds: readonly string[]): Map<string, ModeRecord> {
    const result = new Map<string, ModeRecord>();
    if (userIds.length === 0) return result;
    // Only the number of placeholders is built here; the ids themselves are bound.
    const ids = userIds.map(() => '?').join(', ');
    const rows = this.#db
      .prepare(
        `select user_id, sum(win) as wins, sum(draw) as draws, sum(loss) as losses from (
           select white_user as user_id,
             case when winner = 'white' then 1 else 0 end as win,
             case when winner is null then 1 else 0 end as draw,
             case when winner = 'black' then 1 else 0 end as loss
           from games where mode = ? and rated = 1 and status = 'ended' and voided = 0 and white_user in (${ids})
           union all
           select black_user,
             case when winner = 'black' then 1 else 0 end,
             case when winner is null then 1 else 0 end,
             case when winner = 'white' then 1 else 0 end
           from games where mode = ? and rated = 1 and status = 'ended' and voided = 0 and black_user in (${ids})
         ) group by user_id`,
      )
      .all(mode, ...userIds, mode, ...userIds) as Array<{ user_id: string; wins: number; draws: number; losses: number }>;
    for (const row of rows) result.set(row.user_id, { wins: row.wins, draws: row.draws, losses: row.losses });
    return result;
  }

  /**
   * The summary of a game not held in memory (a finished one) straight from its row. Its moves were checked when they
   * were played, so they are applied as stored: rebuilding the room would generate the legal moves again at every ply,
   * over a second for a few long games, and lists of games (players, profiles, bookmarks) ask for many.
   */
  summaryOf(row: GameRow): GameSummary {
    const cached = this.#room(row.id);
    if (cached) return cached.summary();
    const moves = row.moves ? row.moves.split(' ') : [];
    let position = initialPosition(row.mode, row.first_player, { freeDraft: row.free_draft === 1 });
    for (const text of moves) {
      const move = parseMove(text);
      if (!move) throw new Error(`cannot read move ${text} of game ${row.id}`);
      position = applyMove(position, move);
    }
    const player = (color: Color) => {
      const seat = seatFrom(row, color);
      return { name: seat.name, rating: seat.rating, ratingDiff: seat.ratingDiff, user: seat.userId ? { id: seat.userId, name: seat.name } : null };
    };
    return {
      id: row.id,
      mode: row.mode,
      rated: row.rated === 1,
      timeControl: timeControlOf(row),
      players: { white: player('white'), black: player('black') },
      status: row.status,
      outcome: rowOutcome(row),
      plies: moves.length,
      fen: toFen(position),
      createdAt: row.created_at,
      endedAt: row.ended_at,
      clock: null,
      daysPerMove: row.days_per_move,
      deadlineIn: null,
      turn: null,
      voided: row.voided === 1,
      arena: row.arena_id,
    };
  }
}

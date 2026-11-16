import { moveToString, opposite, type Color, type Mode, type Outcome } from '@ligungi/engine';
import {
  CROSSTABLE_RECENT,
  GAME_LENGTHS,
  RATING_HISTORY_MAX,
  type Crosstable,
  type GameCounts,
  type GameFilters,
  type GameStatus,
  type GameSummary,
  type ModeRecord,
  type ModeStats,
  type RatingPoint,
  type TimeControl,
  type UserRef,
} from '@ligungi/protocol';
import type { Db } from './db.ts';
import { updateRating, PROVISIONAL_DEVIATION } from './glicko.ts';
import { randomId } from './ids.ts';
import { GameRoom, type RoomInit, type Seat } from './room.ts';
import type { Users } from './users.ts';

export interface Player {
  readonly sessionId: string;
  readonly userId: string | null;
  readonly name: string;
}

export interface NewGame {
  readonly mode: Mode;
  readonly rated: boolean;
  readonly timeControl: TimeControl | null;
  readonly daysPerMove: number | null;
  readonly freeDraft: boolean;
  readonly players: Record<Color, Player>;
}

/** History filters with the opponent already resolved to a user id. */
export type HistoryFilters = Omit<GameFilters, 'vs'> & { readonly vsId?: string };

export interface GamesOptions {
  readonly now: () => number;
  readonly abortAfterMs: number;
  readonly claimAfterMs: number;
  /** Pushes the new state of a room to its subscribers. */
  readonly broadcast: (room: GameRoom) => void;
}

interface GameRow {
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

const rowOutcome = (row: GameRow): Outcome | null => {
  if (row.status !== 'ended' || !row.reason) return null;
  return row.winner
    ? ({ winner: row.winner, reason: row.reason } as Outcome)
    : ({ winner: null, reason: row.reason } as Outcome);
};

const seatFrom = (row: GameRow, color: Color): Seat => ({
  sessionId: row[`${color}_session`],
  userId: row[`${color}_user`],
  name: row[`${color}_name`],
  rating: row[`${color}_rating`],
  provisional: row[`${color}_provisional`] === 1,
  ratingDiff: row[`${color}_diff`],
});

/** Finished games kept in memory after being loaded, for quick access (views, rematch offers). */
const FINISHED_CACHE = 500;

/** The clock a stored game was created with: Fischer, byo-yomi, or none. */
const timeControlOf = (row: GameRow): TimeControl | null => {
  if (row.clock_initial === null) return null;
  if (row.clock_byoyomi && row.clock_periods) return { initial: row.clock_initial, increment: 0, byoyomi: row.clock_byoyomi, periods: row.clock_periods };
  return { initial: row.clock_initial, increment: row.clock_increment ?? 0 };
};

export class Games {
  readonly #db: Db;
  readonly #users: Users;
  readonly #options: GamesOptions;
  readonly #rooms = new Map<string, GameRoom>();

  constructor(db: Db, users: Users, options: GamesOptions) {
    this.#db = db;
    this.#users = users;
    this.#options = options;
    const rows = db.prepare("select * from games where status = 'started'").all() as unknown as GameRow[];
    for (const row of rows) this.#rooms.set(row.id, this.#roomFrom(row));
    this.#countBoardMoves();
  }

  /**
   * Games finished before `board_moves` existed get it once, by replaying them; afterwards every save stores it. Only
   * rated games feed the statistics that read it.
   */
  #countBoardMoves(): void {
    const rows = this.#db.prepare("select * from games where status = 'ended' and rated = 1 and board_moves is null").all() as unknown as GameRow[];
    const update = this.#db.prepare('update games set board_moves = ? where id = ?');
    for (const row of rows) {
      // A game that cannot be replayed is skipped (its length stays unknown): a statistic must never stop the server.
      try {
        const room = this.#roomFrom(row);
        update.run(room.boardMoves, row.id);
        room.dispose();
      } catch (error) {
        console.error(`could not count the board moves of game ${row.id}`, error);
      }
    }
  }

  create(game: NewGame): GameRoom {
    const seat = (color: Color): Seat => {
      const player = game.players[color];
      const rating = player.userId ? this.#users.rating(player.userId, game.mode) : null;
      return {
        sessionId: player.sessionId,
        userId: player.userId,
        name: player.name,
        rating: rating ? Math.round(rating.rating) : null,
        provisional: rating ? rating.deviation > PROVISIONAL_DEVIATION : false,
        ratingDiff: null,
      };
    };
    const room = new GameRoom(
      {
        id: this.#newId(),
        mode: game.mode,
        rated: game.rated,
        timeControl: game.timeControl,
        daysPerMove: game.daysPerMove,
        firstPlayer: 'white',
        freeDraft: game.freeDraft,
        seats: { white: seat('white'), black: seat('black') },
        createdAt: this.#options.now(),
      },
      this.#hooks(),
    );
    this.#remember(room);
    this.#persist(room);
    return room;
  }

  get(id: string): GameRoom | undefined {
    const cached = this.#rooms.get(id);
    if (cached) {
      this.#remember(cached);
      return cached;
    }
    const row = this.#db.prepare('select * from games where id = ?').get(id) as GameRow | undefined;
    if (!row) return undefined;
    const room = this.#roomFrom(row);
    this.#remember(room);
    return room;
  }

  /** Rooms currently held in memory (ongoing plus recently used finished ones). */
  get cachedCount(): number {
    return this.#rooms.size;
  }

  hasOngoing(userId: string): boolean {
    return this.ongoing().some((room) => Object.values(room.seats).some((seat) => seat.userId === userId));
  }

  /** Detaches a deleted account from its finished games: they stay in the history under an anonymous name. */
  anonymizeUser(userId: string, anonymousName: string): void {
    for (const color of ['white', 'black'] as const) {
      this.#db
        .prepare(`update games set ${color}_user = null, ${color}_name = ? where ${color}_user = ?`)
        .run(anonymousName, userId);
    }
    for (const [id, room] of this.#rooms) {
      if (room.status !== 'started' && Object.values(room.seats).some((seat) => seat.userId === userId)) {
        room.dispose();
        this.#rooms.delete(id);
      }
    }
  }

  /** A renamed account: its ongoing games show the new name; finished ones are read again from the database. */
  renameUser(userId: string, name: string): void {
    for (const [id, room] of this.#rooms) {
      if (!Object.values(room.seats).some((seat) => seat.userId === userId)) continue;
      if (room.status === 'started') room.renameSeat(userId, name);
      else {
        room.dispose();
        this.#rooms.delete(id);
      }
    }
  }

  /** A suspended player loses every game in progress (or it is aborted, before both players have moved). */
  forfeitAll(userId: string): void {
    for (const room of this.ongoing()) {
      const color = (['white', 'black'] as const).find((c) => room.seats[c].userId === userId);
      if (color) room.forfeit(color);
    }
  }

  /**
   * Voids a finished rated game won by cheating: both players' rating changes from it are undone on their current
   * rating (the victim gets the points back, the cheater loses those gained), and it leaves the statistics.
   */
  voidGame(id: string): GameRoom | 'gameNotFound' | 'gameNotVoidable' {
    const room = this.get(id);
    if (!room) return 'gameNotFound';
    if (room.status !== 'ended' || !room.rated || room.voided) return 'gameNotVoidable';
    for (const seat of Object.values(room.seats)) {
      if (!seat.userId || seat.ratingDiff === null) continue;
      const current = this.#users.rating(seat.userId, room.mode);
      this.#users.saveRating(seat.userId, room.mode, { ...current, rating: current.rating - seat.ratingDiff });
    }
    room.voided = true;
    this.#db.prepare('update games set voided = 1 where id = ?').run(id);
    return room;
  }

  /** Moves anonymous seats to a new session id after login, signup or logout. */
  rebindSession(from: string, to: string): void {
    for (const room of this.#rooms.values()) room.rebindSession(from, to);
  }

  /** Keeps ongoing rooms and the most recently used finished ones; older finished rooms are dropped. */
  #remember(room: GameRoom): void {
    this.#rooms.delete(room.id);
    this.#rooms.set(room.id, room);
    let finished = 0;
    for (const cached of this.#rooms.values()) if (cached.status !== 'started') finished++;
    for (const [id, cached] of this.#rooms) {
      if (finished <= FINISHED_CACHE) break;
      if (cached.status === 'started') continue;
      cached.dispose();
      this.#rooms.delete(id);
      finished--;
    }
  }

  /** Games started since `since` (aborted ones excluded) and games finished overall, for the players page. */
  activity(since: number): { recent: number; finished: number } {
    const recent = this.#db.prepare(`select count(*) as n from games where created_at >= ? and status != 'aborted'`).get(since) as { n: number };
    const finished = this.#db.prepare(`select count(*) as n from games where status = 'ended'`).get() as { n: number };
    return { recent: recent.n, finished: finished.n };
  }

  ongoing(): GameRoom[] {
    return [...this.#rooms.values()].filter((room) => room.status === 'started');
  }

  /**
   * Games being played right now: correspondence games are left out, since a player in one is not busy for the days it
   * lasts (they stay free to challenge, and the TV and the live counts show only games played at the board).
   */
  live(): GameRoom[] {
    return this.ongoing().filter((room) => room.daysPerMove === null);
  }

  playingFor(sessionId: string, userId: string | null): GameSummary[] {
    return this.ongoing()
      .filter((room) => room.colorOf(sessionId, userId) !== null)
      .map((room) => room.summary());
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
    return rows.map((row) => this.#summaryOf(row));
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

  /** Summary of a stored game without keeping its room in memory. */
  #summaryOf(row: GameRow): GameSummary {
    const cached = this.#rooms.get(row.id);
    if (cached) return cached.summary();
    const room = this.#roomFrom(row);
    const summary = room.summary();
    room.dispose();
    return summary;
  }

  /** Stops timers and forgets finished rooms. */
  close(): void {
    for (const room of this.#rooms.values()) room.dispose();
    this.#rooms.clear();
  }

  #newId(): string {
    let id = randomId(8);
    while (this.#rooms.has(id) || this.#db.prepare('select 1 from games where id = ?').get(id)) id = randomId(8);
    return id;
  }

  #hooks() {
    return {
      now: this.#options.now,
      abortAfterMs: this.#options.abortAfterMs,
      claimAfterMs: this.#options.claimAfterMs,
      onChange: (room: GameRoom) => {
        this.#persist(room);
        this.#options.broadcast(room);
      },
      onEnd: (room: GameRoom) => this.#rate(room),
      onRematch: (room: GameRoom) => this.#rematch(room).id,
    };
  }

  #rematch(room: GameRoom): GameRoom {
    const player = (seat: Seat): Player => ({ sessionId: seat.sessionId, userId: seat.userId, name: seat.name });
    return this.create({
      mode: room.mode,
      rated: room.rated,
      timeControl: room.timeControl,
      daysPerMove: room.daysPerMove,
      freeDraft: room.freeDraft,
      players: { white: player(room.seats.black), black: player(room.seats.white) },
    });
  }

  #rate(room: GameRoom): void {
    const { white, black } = room.seats;
    if (!room.rated || !room.outcome || !white.userId || !black.userId) return;
    const before = { white: this.#users.rating(white.userId, room.mode), black: this.#users.rating(black.userId, room.mode) };
    const score = (color: Color): 0 | 0.5 | 1 =>
      room.outcome!.winner === null ? 0.5 : room.outcome!.winner === color ? 1 : 0;
    for (const color of ['white', 'black'] as const) {
      const seat = room.seats[color];
      const updated = updateRating(before[color], before[opposite(color)], score(color));
      this.#users.saveRating(seat.userId!, room.mode, { ...updated, games: before[color].games + 1 });
      seat.ratingDiff = Math.round(updated.rating) - Math.round(before[color].rating);
    }
  }

  #roomFrom(row: GameRow): GameRoom {
    const init: RoomInit = {
      id: row.id,
      mode: row.mode,
      rated: row.rated === 1,
      timeControl: timeControlOf(row),
      firstPlayer: row.first_player,
      freeDraft: row.free_draft === 1,
      seats: { white: seatFrom(row, 'white'), black: seatFrom(row, 'black') },
      createdAt: row.created_at,
      moves: row.moves ? row.moves.split(' ') : [],
      status: row.status,
      outcome: rowOutcome(row),
      clock:
        row.clock_white === null || row.clock_black === null
          ? null
          : { white: row.clock_white, black: row.clock_black, running: row.clock_running },
      daysPerMove: row.days_per_move,
      deadline: row.deadline,
      rematchId: row.rematch_id,
      endedAt: row.ended_at,
      voided: row.voided === 1,
    };
    return new GameRoom(init, this.#hooks());
  }

  #persist(room: GameRoom): void {
    const now = this.#options.now();
    const clock = room.clock?.view(now) ?? null;
    const { white, black } = room.seats;
    const moves = room.game.moves.map(moveToString).join(' ');
    this.#db
      .prepare(
        `insert into games (id, mode, rated, clock_initial, clock_increment, clock_byoyomi, clock_periods, first_player, free_draft,
          white_session, white_user, white_name, white_rating, white_provisional, white_diff,
          black_session, black_user, black_name, black_rating, black_provisional, black_diff,
          moves, status, winner, reason, clock_white, clock_black, clock_running, days_per_move, deadline, rematch_id,
          created_at, ended_at, updated_at, board_moves)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set white_session = excluded.white_session, black_session = excluded.black_session,
          white_diff = excluded.white_diff, black_diff = excluded.black_diff,
          moves = excluded.moves, status = excluded.status, winner = excluded.winner, reason = excluded.reason,
          clock_white = excluded.clock_white, clock_black = excluded.clock_black, clock_running = excluded.clock_running,
          deadline = excluded.deadline, rematch_id = excluded.rematch_id, ended_at = excluded.ended_at, updated_at = excluded.updated_at,
          board_moves = excluded.board_moves`,
      )
      .run(
        room.id,
        room.mode,
        room.rated ? 1 : 0,
        room.timeControl?.initial ?? null,
        room.timeControl?.increment ?? null,
        room.timeControl?.byoyomi ?? null,
        room.timeControl?.periods ?? null,
        room.firstPlayer,
        room.freeDraft ? 1 : 0,
        white.sessionId,
        white.userId,
        white.name,
        white.rating,
        white.provisional ? 1 : 0,
        white.ratingDiff,
        black.sessionId,
        black.userId,
        black.name,
        black.rating,
        black.provisional ? 1 : 0,
        black.ratingDiff,
        moves,
        room.status,
        room.outcome?.winner ?? null,
        room.outcome?.reason ?? null,
        clock?.white ?? null,
        clock?.black ?? null,
        clock?.running ?? null,
        room.daysPerMove,
        room.deadline,
        room.rematchId,
        room.createdAt,
        room.endedAt,
        now,
        room.status === 'ended' ? room.boardMoves : null,
      );
  }
}

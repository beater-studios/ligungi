import { moveToString, opposite, type Color, type Mode, type Outcome } from '@ligungi/engine';
import type { GameCounts, GameFilters, GameStatus, GameSummary, TimeControl } from '@ligungi/protocol';
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
  readonly firstPlayer: Color;
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
  rematch_id: string | null;
  created_at: number;
  ended_at: number | null;
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
        firstPlayer: game.firstPlayer,
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

  ongoing(): GameRoom[] {
    return [...this.#rooms.values()].filter((room) => room.status === 'started');
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

  counts(userId: string): GameCounts {
    const row = this.#db
      .prepare(
        `select count(*) as games,
          sum(rated) as rated,
          sum(case when (winner = 'white' and white_user = ?1) or (winner = 'black' and black_user = ?1) then 1 else 0 end) as wins,
          sum(case when winner is not null and not ((winner = 'white' and white_user = ?1) or (winner = 'black' and black_user = ?1)) then 1 else 0 end) as losses,
          sum(case when status = 'ended' and winner is null then 1 else 0 end) as draws
         from games where (white_user = ?1 or black_user = ?1) and status = 'ended'`,
      )
      .get(userId) as { games: number; rated: number | null; wins: number | null; losses: number | null; draws: number | null };
    return { games: row.games, rated: row.rated ?? 0, wins: row.wins ?? 0, losses: row.losses ?? 0, draws: row.draws ?? 0 };
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
      firstPlayer: room.firstPlayer,
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
      timeControl:
        row.clock_initial === null ? null : { initial: row.clock_initial, increment: row.clock_increment ?? 0 },
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
      rematchId: row.rematch_id,
      endedAt: row.ended_at,
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
        `insert into games (id, mode, rated, clock_initial, clock_increment, first_player, free_draft,
          white_session, white_user, white_name, white_rating, white_provisional, white_diff,
          black_session, black_user, black_name, black_rating, black_provisional, black_diff,
          moves, status, winner, reason, clock_white, clock_black, clock_running, rematch_id,
          created_at, ended_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set white_session = excluded.white_session, black_session = excluded.black_session,
          white_diff = excluded.white_diff, black_diff = excluded.black_diff,
          moves = excluded.moves, status = excluded.status, winner = excluded.winner, reason = excluded.reason,
          clock_white = excluded.clock_white, clock_black = excluded.clock_black, clock_running = excluded.clock_running,
          rematch_id = excluded.rematch_id, ended_at = excluded.ended_at, updated_at = excluded.updated_at`,
      )
      .run(
        room.id,
        room.mode,
        room.rated ? 1 : 0,
        room.timeControl?.initial ?? null,
        room.timeControl?.increment ?? null,
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
        room.rematchId,
        room.createdAt,
        room.endedAt,
        now,
      );
  }
}

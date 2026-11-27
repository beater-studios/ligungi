import { moveToString, opposite, type Color, type Mode } from '@ligungi/engine';
import {
  BOOKMARKS_MAX,
  type BookmarkedGame,
  type BookmarkView,
  type GameSummary,
  type TimeControl,
} from '@ligungi/protocol';
import type { Db } from './db.ts';
import { updateRating, PROVISIONAL_DEVIATION } from './glicko.ts';
import { randomId } from './ids.ts';
import { GameRoom, type RoomInit, type Seat } from './room.ts';
import type { Users } from './users.ts';
import { GameHistory, rowOutcome, seatFrom, timeControlOf, type GameRow } from './game-history.ts';

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
  /** The Arena pairing this game, if any. */
  readonly arena?: string;
}

export interface GamesOptions {
  readonly now: () => number;
  readonly abortAfterMs: number;
  readonly claimAfterMs: number;
  /** Pushes the new state of a room to its subscribers. */
  readonly broadcast: (room: GameRoom) => void;
  /** Called after players' ratings change: a rated game ended or one was voided. */
  readonly ratingsChanged?: (userIds: readonly string[]) => void;
  /** A game is over, ended or aborted, after it was saved and broadcast. */
  readonly finished?: (room: GameRoom) => void;
}

/** Finished games kept in memory after being loaded, for quick access (views, rematch offers). */
const FINISHED_CACHE = 500;

/** The stored draft queues; anything unreadable counts as no queue, so a bad row never blocks loading a game. */
const draftQueueFrom = (text: string | null): Record<Color, readonly string[]> | null => {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<Record<Color, unknown>>;
    const list = (entry: unknown): string[] => (Array.isArray(entry) ? entry.filter((move): move is string => typeof move === 'string') : []);
    return { white: list(value.white), black: list(value.black) };
  } catch {
    return null;
  }
};

export class Games {
  readonly #db: Db;
  readonly #users: Users;
  readonly #options: GamesOptions;
  readonly #rooms = new Map<string, GameRoom>();
  /** The finished games as stored, for the lists, search and statistics. */
  readonly history: GameHistory;

  constructor(db: Db, users: Users, options: GamesOptions) {
    this.#db = db;
    this.#users = users;
    this.#options = options;
    this.history = new GameHistory(db, (id) => this.#rooms.get(id));
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
        arena: game.arena ?? null,
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
    this.#options.ratingsChanged?.(Object.values(room.seats).flatMap((seat) => (seat.userId ? [seat.userId] : [])));
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

  exists(id: string): boolean {
    return this.#rooms.has(id) || Boolean(this.#db.prepare('select 1 from games where id = ?').get(id));
  }

  bookmark(userId: string, gameId: string): BookmarkView {
    const row = this.#db.prepare('select note from game_bookmarks where user_id = ? and game_id = ?').get(userId, gameId) as { note: string } | undefined;
    return row ? { bookmarked: true, note: row.note } : { bookmarked: false, note: '' };
  }

  /** Bookmarks a game for a player, or changes the note of one already bookmarked. */
  saveBookmark(userId: string, gameId: string, note: string): BookmarkView {
    const now = this.#options.now();
    this.#db
      .prepare(
        `insert into game_bookmarks (user_id, game_id, note, created_at, updated_at) values (?, ?, ?, ?, ?)
         on conflict (user_id, game_id) do update set note = excluded.note, updated_at = excluded.updated_at`,
      )
      .run(userId, gameId, note, now, now);
    return { bookmarked: true, note };
  }

  removeBookmark(userId: string, gameId: string): BookmarkView {
    this.#db.prepare('delete from game_bookmarks where user_id = ? and game_id = ?').run(userId, gameId);
    return { bookmarked: false, note: '' };
  }

  /** A player's bookmarked games, newest bookmark first, each as it stands now (an ongoing game included). */
  bookmarks(userId: string): BookmarkedGame[] {
    const rows = this.#db
      .prepare(
        `select games.*, game_bookmarks.note as bookmark_note, game_bookmarks.created_at as bookmarked_at from game_bookmarks
         join games on games.id = game_bookmarks.game_id
         where game_bookmarks.user_id = ? order by game_bookmarks.created_at desc, game_bookmarks.rowid desc limit ?`,
      )
      .all(userId, BOOKMARKS_MAX) as unknown as Array<GameRow & { bookmark_note: string; bookmarked_at: number }>;
    return rows.map((row) => ({ game: this.#rooms.get(row.id)?.summary() ?? this.history.summaryOf(row), note: row.bookmark_note, bookmarkedAt: row.bookmarked_at }));
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
      onFinish: (room: GameRoom) => this.#options.finished?.(room),
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
      this.#users.saveRating(seat.userId!, room.mode, { ...updated, games: before[color].games + 1 }, true);
      seat.ratingDiff = Math.round(updated.rating) - Math.round(before[color].rating);
    }
    this.#options.ratingsChanged?.([white.userId, black.userId]);
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
      draftQueue: draftQueueFrom(row.draft_queue),
      arena: row.arena_id,
      berserk: row.berserk ? { white: row.berserk.includes('w'), black: row.berserk.includes('b') } : null,
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
          created_at, ended_at, updated_at, board_moves, draft_queue, arena_id, berserk)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set white_session = excluded.white_session, black_session = excluded.black_session,
          white_diff = excluded.white_diff, black_diff = excluded.black_diff,
          moves = excluded.moves, status = excluded.status, winner = excluded.winner, reason = excluded.reason,
          clock_white = excluded.clock_white, clock_black = excluded.clock_black, clock_running = excluded.clock_running,
          deadline = excluded.deadline, rematch_id = excluded.rematch_id, ended_at = excluded.ended_at, updated_at = excluded.updated_at,
          board_moves = excluded.board_moves, draft_queue = excluded.draft_queue, berserk = excluded.berserk`,
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
        room.draftQueue.white.length || room.draftQueue.black.length ? JSON.stringify(room.draftQueue) : null,
        room.arena,
        `${room.berserk.white ? 'w' : ''}${room.berserk.black ? 'b' : ''}` || null,
      );
  }
}

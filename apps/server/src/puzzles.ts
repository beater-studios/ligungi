import type { Mode } from '@ligungi/engine';
import { type ActivityEvent, PUZZLE_RUN_KINDS, PUZZLE_RUN_RECENT_MS, type PuzzleRun, type PuzzleRunKind, type PuzzleRunsView, type DailyPuzzle, type PuzzleAttemptResult, type PuzzleDashboard, type PuzzleRatingView, type PuzzleView } from '@ligungi/protocol';
import { puzzleInfo, type Puzzle, type PuzzleInfo, type PuzzleTheme } from '@ligungi/content';
import { PUZZLES } from '@ligungi/content/puzzles';
import type { Db } from './db.ts';
import { DEFAULT_RATING, PROVISIONAL_DEVIATION, updateRating, type Rating } from './glicko.ts';

/** How sure the rating of a puzzle nobody tried yet is: less than a new player's, since its start comes from its length. */
const PUZZLE_DEVIATION = 200;
/** The next puzzle is drawn among this many of the closest to the player's rating, so the order is not always the same. */
const NEXT_POOL = 12;
/** Puzzles of the day are taken among the ones starting in this range: neither trivial nor discouraging. */
const DAILY_RANGE = [1000, 1700] as const;
/**
 * The difficulty curve of a timed run: the target rating of its first puzzle, how much it rises per puzzle, and how
 * many puzzles the run holds. Each puzzle is drawn among the `RUN_POOL` closest to the target that the run has not used.
 */
const RUN_CURVES: Readonly<Record<PuzzleRunKind | 'racer', { readonly start: number; readonly step: number; readonly count: number }>> = {
  streak: { start: 1000, step: 20, count: PUZZLES.length },
  storm: { start: 1000, step: 10, count: 150 },
  // 90 seconds: more puzzles than anyone solves, rising faster than Storm's.
  racer: { start: 1000, step: 12, count: 80 },
};
const RUN_POOL = 6;

const PUZZLE_BY_ID: ReadonlyMap<string, { readonly puzzle: Puzzle; readonly info: PuzzleInfo }> = new Map(
  PUZZLES.map((puzzle) => [puzzle.id, { puzzle, info: puzzleInfo(puzzle) }]),
);

export const isPuzzle = (id: string): boolean => PUZZLE_BY_ID.has(id);

/** A puzzle and what it is, by id. */
export const puzzleEntry = (id: string): { readonly puzzle: Puzzle; readonly info: PuzzleInfo } | undefined => PUZZLE_BY_ID.get(id);

/** No run can solve more puzzles than there are. */
export const PUZZLE_COUNT = PUZZLES.length;

interface StoredRating extends Rating {
  readonly games: number;
}

const ratingView = (rating: StoredRating): PuzzleRatingView => ({
  rating: Math.round(rating.rating),
  provisional: rating.deviation > PROVISIONAL_DEVIATION,
  games: rating.games,
});

/** A stable number from a text, to pick the puzzle of a day. */
const hash = (text: string): number => {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value;
};

/**
 * Puzzle ratings and tries. Each player has a puzzle rating apart from the game ratings, and each puzzle has its own,
 * starting from its length and kind: a try is a game between the two, scored with Glicko-2. Only the first try at a
 * puzzle counts.
 */
export class PuzzleStore {
  readonly #db: Db;
  readonly #now: () => number;
  readonly #random: () => number;

  constructor(db: Db, now: () => number, random: () => number = Math.random) {
    this.#db = db;
    this.#now = now;
    this.#random = random;
  }

  rating(userId: string): StoredRating {
    const row = this.#db.prepare('select rating, deviation, volatility, games from puzzle_ratings where user_id = ?').get(userId) as StoredRating | undefined;
    return row ?? { ...DEFAULT_RATING, games: 0 };
  }

  /** The player's puzzle rating as shown: rounded, with whether it is still provisional. */
  ratingView(userId: string): PuzzleRatingView {
    return ratingView(this.rating(userId));
  }

  #puzzleRating(id: string): StoredRating & { readonly wins: number } {
    const row = this.#db.prepare('select rating, deviation, volatility, plays as games, wins from puzzle_stats where puzzle_id = ?').get(id) as
      | (StoredRating & { wins: number })
      | undefined;
    return row ?? { rating: PUZZLE_BY_ID.get(id)!.info.startRating, deviation: PUZZLE_DEVIATION, volatility: DEFAULT_RATING.volatility, games: 0, wins: 0 };
  }

  #attempt(userId: string, id: string): { win: boolean } | null {
    const row = this.#db.prepare('select win from puzzle_attempts where user_id = ? and puzzle_id = ?').get(userId, id) as { win: number } | undefined;
    return row ? { win: row.win === 1 } : null;
  }

  view(id: string, userId: string | null): PuzzleView {
    const stats = this.#puzzleRating(id);
    return { id, rating: Math.round(stats.rating), plays: stats.games, attempt: userId ? this.#attempt(userId, id) : null };
  }

  /** Records a try. The first one moves both ratings; later ones change nothing and say so. */
  attempt(userId: string, id: string, win: boolean): PuzzleAttemptResult {
    const before = this.rating(userId);
    if (this.#attempt(userId, id)) return { win, rating: ratingView(before), change: 0, counted: false };
    const puzzle = this.#puzzleRating(id);
    const player = updateRating(before, puzzle, win ? 1 : 0);
    const puzzleAfter = updateRating(puzzle, before, win ? 0 : 1);
    const after: StoredRating = { ...player, games: before.games + 1 };
    const change = Math.round(after.rating) - Math.round(before.rating);
    this.#db.exec('begin');
    try {
      this.#db
        .prepare(
          `insert into puzzle_ratings (user_id, rating, deviation, volatility, games) values (?, ?, ?, ?, ?)
           on conflict (user_id) do update set rating = excluded.rating, deviation = excluded.deviation, volatility = excluded.volatility, games = excluded.games`,
        )
        .run(userId, after.rating, after.deviation, after.volatility, after.games);
      this.#db
        .prepare(
          `insert into puzzle_stats (puzzle_id, rating, deviation, volatility, plays, wins) values (?, ?, ?, ?, ?, ?)
           on conflict (puzzle_id) do update set rating = excluded.rating, deviation = excluded.deviation, volatility = excluded.volatility,
             plays = excluded.plays, wins = excluded.wins`,
        )
        .run(id, puzzleAfter.rating, puzzleAfter.deviation, puzzleAfter.volatility, puzzle.games + 1, puzzle.wins + (win ? 1 : 0));
      this.#db
        .prepare('insert into puzzle_attempts (user_id, puzzle_id, win, rating, change, created_at) values (?, ?, ?, ?, ?, ?)')
        .run(userId, id, win ? 1 : 0, Math.round(after.rating), change, this.#now());
      this.#db.exec('commit');
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
    return { win, rating: ratingView(after), change, counted: true };
  }

  /** Puzzles solved without an account, brought to it on signing in: kept as solved, without touching any rating. */
  importSolved(userId: string, ids: readonly string[]): void {
    const insert = this.#db.prepare('insert or ignore into puzzle_attempts (user_id, puzzle_id, win, rating, change, created_at) values (?, ?, 1, null, null, ?)');
    const now = this.#now();
    for (const id of ids) insert.run(userId, id, now);
  }

  solved(userId: string): string[] {
    const rows = this.#db.prepare('select puzzle_id from puzzle_attempts where user_id = ? and win = 1 order by created_at, puzzle_id').all(userId) as Array<{
      puzzle_id: string;
    }>;
    return rows.map((row) => row.puzzle_id);
  }

  /**
   * A puzzle to try next: one of the closest to the player's rating among those of the theme and mode asked and not yet
   * tried. Without an account, `exclude` lists what the browser already solved. `null` when nothing is left.
   */
  next(userId: string | null, filter: { theme: PuzzleTheme | null; mode: Mode | null }, exclude: readonly string[] = []): string | null {
    const tried = new Set(exclude);
    if (userId) {
      const rows = this.#db.prepare('select puzzle_id from puzzle_attempts where user_id = ?').all(userId) as Array<{ puzzle_id: string }>;
      for (const row of rows) tried.add(row.puzzle_id);
    }
    const target = userId ? this.rating(userId).rating : DEFAULT_RATING.rating - 300;
    const ratings = this.#liveRatings();
    const candidates = [...PUZZLE_BY_ID.values()]
      .filter(({ puzzle, info }) => !tried.has(puzzle.id) && (!filter.theme || info.themes.includes(filter.theme)) && (!filter.mode || info.mode === filter.mode))
      .map(({ puzzle }) => ({ id: puzzle.id, distance: Math.abs(ratings.get(puzzle.id)! - target) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, NEXT_POOL);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(this.#random() * candidates.length)]!.id;
  }

  /** The live rating of every puzzle: its own once tried, its start rating before that. */
  #liveRatings(): Map<string, number> {
    const rated = new Map(
      (this.#db.prepare('select puzzle_id, rating from puzzle_stats').all() as Array<{ puzzle_id: string; rating: number }>).map((row) => [row.puzzle_id, row.rating]),
    );
    return new Map([...PUZZLE_BY_ID.values()].map(({ puzzle, info }) => [puzzle.id, rated.get(puzzle.id) ?? info.startRating]));
  }

  /** The puzzles of a new timed run or race, in order, getting harder along its curve; every mode is mixed. */
  sequence(kind: PuzzleRunKind | 'racer'): string[] {
    const { start, step, count } = RUN_CURVES[kind];
    const pool = [...this.#liveRatings()].map(([id, rating]) => ({ id, rating, tie: this.#random() }));
    const ids: string[] = [];
    while (ids.length < count && pool.length > 0) {
      const target = start + ids.length * step;
      pool.sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target) || a.tie - b.tie);
      const [picked] = pool.splice(Math.floor(this.#random() * Math.min(RUN_POOL, pool.length)), 1);
      ids.push(picked!.id);
    }
    return ids;
  }

  runs(userId: string): PuzzleRunsView {
    const runs = this.#db
      .prepare('select kind, score, created_at as at from puzzle_runs where user_id = ? and created_at >= ? order by created_at')
      .all(userId, this.#now() - PUZZLE_RUN_RECENT_MS) as unknown as PuzzleRun[];
    const bests = this.#db.prepare('select kind, max(score) as score from puzzle_runs where user_id = ? group by kind').all(userId) as Array<{
      kind: PuzzleRunKind;
      score: number;
    }>;
    const best = Object.fromEntries(PUZZLE_RUN_KINDS.map((kind) => [kind, bests.find((row) => row.kind === kind)?.score ?? 0])) as Record<PuzzleRunKind, number>;
    return { runs: runs.map(({ kind, score, at }) => ({ kind, score, at })), best };
  }

  /** Every run of the player, oldest first, for the data export. */
  /** Puzzles tried and puzzle runs finished since a moment, for the player's own activity. */
  activitySince(userId: string, since: number): ActivityEvent[] {
    const tries = this.#db
      .prepare('select win, change, created_at as at from puzzle_attempts where user_id = ? and created_at >= ?')
      .all(userId, since) as Array<{ win: number; change: number | null; at: number }>;
    const runs = this.#db
      .prepare('select kind, score, created_at as at from puzzle_runs where user_id = ? and created_at >= ?')
      .all(userId, since) as Array<{ kind: 'streak' | 'storm'; score: number; at: number }>;
    return [
      ...tries.map((row): ActivityEvent => ({ kind: 'puzzle', at: row.at, win: row.win === 1, change: row.change })),
      ...runs.map((row): ActivityEvent => ({ kind: 'run', at: row.at, run: row.kind, score: row.score })),
    ];
  }

  allRuns(userId: string): PuzzleRun[] {
    return (this.#db.prepare('select kind, score, created_at as at from puzzle_runs where user_id = ? order by created_at').all(userId) as unknown as PuzzleRun[]).map(
      ({ kind, score, at }) => ({ kind, score, at }),
    );
  }

  saveRuns(userId: string, runs: readonly PuzzleRun[]): void {
    const insert = this.#db.prepare('insert into puzzle_runs (user_id, kind, score, created_at) values (?, ?, ?, ?)');
    this.#db.exec('begin');
    try {
      for (const run of runs) insert.run(userId, run.kind, run.score, run.at);
      this.#db.exec('commit');
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
  }

  /** The puzzle of a day (`YYYY-MM-DD`, in UTC), the same for everyone. */
  daily(day: string): DailyPuzzle {
    const pool = [...PUZZLE_BY_ID.values()]
      .filter(({ info }) => info.startRating >= DAILY_RANGE[0] && info.startRating <= DAILY_RANGE[1])
      .sort((a, b) => a.puzzle.id.localeCompare(b.puzzle.id));
    const { puzzle, info } = pool[hash(day) % pool.length]!;
    return { id: puzzle.id, day, fen: puzzle.fen, color: info.color, kind: info.kind, moves: info.moves };
  }

  dashboard(userId: string): PuzzleDashboard {
    const rows = this.#db
      .prepare('select puzzle_id, win, rating, change, created_at from puzzle_attempts where user_id = ? order by created_at, puzzle_id')
      .all(userId) as Array<{ puzzle_id: string; win: number; rating: number | null; change: number | null; created_at: number }>;
    const themes: Partial<Record<PuzzleTheme, { tries: number; wins: number }>> = {};
    for (const row of rows) {
      for (const theme of PUZZLE_BY_ID.get(row.puzzle_id)?.info.themes ?? []) {
        const entry = (themes[theme] ??= { tries: 0, wins: 0 });
        entry.tries++;
        if (row.win) entry.wins++;
      }
    }
    return {
      rating: ratingView(this.rating(userId)),
      history: rows
        .filter((row) => row.rating !== null)
        .map((row) => ({ id: row.puzzle_id, win: row.win === 1, rating: row.rating!, change: row.change ?? 0, at: row.created_at })),
      themes,
    };
  }
}

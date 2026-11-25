import { applyMove, legalMoves, moveToString, parseFen, parseMove, type Color, type Mode, type Move, type Position } from '@ligungi/engine';

/**
 * A puzzle as stored: a play phase position, the side to move solving it, and the solution line in machine notation
 * (the solver's moves with the opponent's answers in between). Everything else is read from the line.
 */
export interface Puzzle {
  readonly id: string;
  readonly fen: string;
  readonly line: readonly string[];
  /** Kept with the line so reading every puzzle needs no move generation; the tests check it. */
  readonly kind: 'mate' | 'material';
}

export const PUZZLE_THEMES = ['mateIn1', 'mateIn2', 'mateIn3', 'material', 'capture', 'drop', 'stack', 'betrayal'] as const;
export type PuzzleTheme = (typeof PUZZLE_THEMES)[number];

/**
 * What a puzzle is about. `mate`: the line ends with the opponent out of moves, every solver move attacking the Marshal
 * (the tsume convention). `material`: the line wins material, with a single good move at each step.
 */
export interface PuzzleInfo {
  readonly mode: Mode;
  readonly color: Color;
  readonly kind: Puzzle['kind'];
  /** The solver's moves. */
  readonly moves: number;
  readonly themes: readonly PuzzleTheme[];
  /** Rating before anyone tried it: longer and mating lines start higher. */
  readonly startRating: number;
}

const START_RATINGS: Readonly<Record<PuzzleInfo['kind'], readonly number[]>> = {
  mate: [1000, 1300, 1600],
  material: [1100, 1400, 1700],
};

/** The positions along a puzzle's line, from the start to the end of the solution, checking every move is legal. */
export const puzzlePositions = (puzzle: Puzzle): Position[] => {
  const positions = [parseFen(puzzle.fen)];
  for (const text of puzzle.line) {
    const position = positions[positions.length - 1]!;
    const move = legalMoves(position).find((candidate) => moveToString(candidate) === text);
    if (!move) throw new Error(`Puzzle ${puzzle.id}: ${text} is not legal`);
    positions.push(applyMove(position, move));
  }
  return positions;
};

/**
 * What a puzzle is, from its line. The moves are read as written, without generating the legal ones: the stored lines
 * are checked by the tests, and the server and the page read every puzzle when they start.
 */
export const puzzleInfo = (puzzle: Puzzle): PuzzleInfo => {
  const start = parseFen(puzzle.fen);
  const moves: Move[] = puzzle.line.map((text) => parseMove(text)!);
  const kind = puzzle.kind;
  const solverMoves = Math.ceil(puzzle.line.length / 2);
  const themes = new Set<PuzzleTheme>(kind === 'mate' ? [`mateIn${Math.min(solverMoves, 3) as 1 | 2 | 3}`] : ['material']);
  moves.forEach((move, index) => {
    if (index % 2 === 1) return;
    if (move.kind === 'drop') themes.add('drop');
    if (move.kind === 'move' && move.action === 'capture') themes.add('capture');
    if (move.kind === 'move' && move.action === 'stack') themes.add('stack');
    if (move.kind !== 'done' && move.betray && move.betray.length > 0) themes.add('betrayal');
  });
  const ladder = START_RATINGS[kind];
  return {
    mode: start.mode,
    color: start.turn,
    kind,
    moves: solverMoves,
    themes: PUZZLE_THEMES.filter((theme) => themes.has(theme)),
    startRating: ladder[Math.min(solverMoves, ladder.length) - 1]!,
  };
};

/** Puzzle results a player saves in one request (results earned without an account, sent when signing in). */
export const PUZZLE_BATCH = 200;

/** A puzzle as the trainer shows it: its live rating, how often it was tried, and the viewer's first try. */
export interface PuzzleView {
  readonly id: string;
  readonly rating: number;
  readonly plays: number;
  /** The viewer's first try, which is the one that counts; `null` when they never tried it or are not signed in. */
  readonly attempt: { readonly win: boolean } | null;
}

/** The puzzle of the day, with enough to show it on the home page without loading every puzzle. */
export interface DailyPuzzle {
  readonly id: string;
  /** `YYYY-MM-DD`, in UTC. */
  readonly day: string;
  readonly fen: string;
  readonly color: Color;
  readonly kind: PuzzleInfo['kind'];
  readonly moves: number;
}

export interface PuzzleRatingView {
  readonly rating: number;
  readonly provisional: boolean;
  readonly games: number;
}

/** The answer to a first try: the player's puzzle rating after it and the change. */
export interface PuzzleAttemptResult {
  readonly win: boolean;
  readonly rating: PuzzleRatingView;
  readonly change: number;
  /** False when the puzzle had been tried before: only the first try counts. */
  readonly counted: boolean;
}

export interface PuzzleHistoryEntry {
  readonly id: string;
  readonly win: boolean;
  /** The player's rating after the try, and its change. */
  readonly rating: number;
  readonly change: number;
  readonly at: number;
}

export interface PuzzleDashboard {
  readonly rating: PuzzleRatingView;
  /** Every counted try, oldest first. */
  readonly history: readonly PuzzleHistoryEntry[];
  /** Tries and wins by theme, over every counted try. */
  readonly themes: Readonly<Partial<Record<PuzzleTheme, { readonly tries: number; readonly wins: number }>>>;
}

/** Timed puzzle runs. Streak: harder and harder puzzles until the first mistake. Storm: as many as possible in 3 minutes. */
export const PUZZLE_RUN_KINDS = ['streak', 'storm'] as const;
export type PuzzleRunKind = (typeof PUZZLE_RUN_KINDS)[number];

/** Storm's clock, as on lichess: 3 minutes, 10 seconds off for a wrong move, and time back for long combos. */
export const STORM_TIME_MS = 180_000;
export const STORM_PENALTY_MS = 10_000;
const STORM_BONUSES: ReadonlyMap<number, number> = new Map([
  [5, 3],
  [12, 5],
  [20, 7],
  [30, 10],
]);

/** Seconds a Storm combo of correct moves adds when it reaches `combo`: at 5, 12, 20 and 30, then every 10 more. */
export const stormBonus = (combo: number): number => STORM_BONUSES.get(combo) ?? (combo > 30 && combo % 10 === 0 ? 10 : 0);

/** A finished run: how many puzzles it solved, and when (ms). */
export interface PuzzleRun {
  readonly kind: PuzzleRunKind;
  readonly score: number;
  readonly at: number;
}

/** Runs saved in one request (runs played without an account, sent when signing in). */
export const PUZZLE_RUN_BATCH = 100;

/**
 * Validates the runs a player sends, at most `PUZZLE_RUN_BATCH`: a kind, a score up to `maxScore` (the puzzles there are)
 * and a time up to `latest` (ms).
 */
export const parsePuzzleRuns = (input: unknown, maxScore: number, latest: number): PuzzleRun[] | 'invalidPuzzleRun' => {
  if (!Array.isArray(input) || input.length > PUZZLE_RUN_BATCH) return 'invalidPuzzleRun';
  const runs: PuzzleRun[] = [];
  for (const run of input as unknown[]) {
    if (typeof run !== 'object' || run === null) return 'invalidPuzzleRun';
    const { kind, score, at } = run as Record<string, unknown>;
    const known = PUZZLE_RUN_KINDS.find((value) => value === kind);
    if (!known || typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > maxScore) return 'invalidPuzzleRun';
    if (typeof at !== 'number' || !Number.isInteger(at) || at < 0 || at > latest) return 'invalidPuzzleRun';
    runs.push({ kind: known, score, at });
  }
  return runs;
};
/** How far back the recent runs go: a week, with a day to spare for time zones. */
export const PUZZLE_RUN_RECENT_MS = 8 * 86_400_000;

/** The player's recent runs (for the best of today and of the week) and the best score ever of each kind. */
export interface PuzzleRunsView {
  readonly runs: readonly PuzzleRun[];
  readonly best: Readonly<Record<PuzzleRunKind, number>>;
}

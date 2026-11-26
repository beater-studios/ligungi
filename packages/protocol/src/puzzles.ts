import type { Color } from '@ligungi/engine';
import type { PuzzleInfo, PuzzleTheme } from '@ligungi/content';

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

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

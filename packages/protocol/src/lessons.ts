import {
  applyMove,
  findMarshal,
  opposite,
  parseFen,
  parseSquare,
  squareName,
  topOf,
  type Color,
  type Mode,
  type Move,
  type Position,
} from '@ligungi/engine';

/**
 * What an exercise asks. `targets`: end moves on every starred square (moving, stacking, capturing or dropping
 * there). `escape`: get the Marshal out of attack. `betray`: turn the enemy pieces of a tower with the Tactician.
 * `mate`: mate in that many moves against the computer's best defense. `placeMarshal` and `finishDraft`: the draft.
 * In every goal but `mate` the opponent does not move, so the player keeps the turn.
 */
export type LessonGoal =
  | { readonly kind: 'targets'; readonly squares: readonly string[] }
  | { readonly kind: 'escape' }
  | { readonly kind: 'betray'; readonly square: string }
  | { readonly kind: 'mate'; readonly moves: number }
  | { readonly kind: 'placeMarshal' }
  | { readonly kind: 'finishDraft' };

export interface LessonExercise {
  readonly id: string;
  readonly fen: string;
  readonly goal: LessonGoal;
  /** The fewest moves that reach the goal: done in that many, the exercise earns three stars. */
  readonly par: number;
}

export const LESSON_STAGE_IDS = ['pieces', 'towers', 'hand', 'jumpers', 'betrayal', 'marshal', 'mate', 'draft'] as const;
export type LessonStageId = (typeof LESSON_STAGE_IDS)[number];

export interface LessonStage {
  readonly id: LessonStageId;
  readonly exercises: readonly LessonExercise[];
}

export const LESSON_STARS_MAX = 3;

/** Lesson results a player saves in one request. */
export const LESSON_PROGRESS_BATCH = 100;

/**
 * A position for an exercise: pieces by square in machine notation, a tower written bottom to top (`{ e3: 'Ps' }` is
 * a White Soldier under a Black Samurai), White to move and the full game's rules unless said otherwise.
 */
const fen = (
  pieces: Readonly<Record<string, string>>,
  { hands = '-', mode = 'advanced', phase = 'p', first = 'w' }: { hands?: string; mode?: Mode; phase?: string; first?: 'w' | 'b' } = {},
): string => {
  const ranks: string[] = [];
  for (let rank = 9; rank >= 1; rank--) {
    let text = '';
    let empty = 0;
    for (const file of 'abcdefghi') {
      const tower = pieces[`${file}${rank}`];
      if (!tower) {
        empty++;
        continue;
      }
      if (empty) text += String(empty);
      empty = 0;
      text += tower.length > 1 ? `(${tower})` : tower;
    }
    ranks.push(empty ? text + String(empty) : text);
  }
  return `${ranks.join('/')} w ${hands} ${mode} ${phase} ${first}`;
};

const targets = (...squares: string[]): LessonGoal => ({ kind: 'targets', squares });

export const LESSON_STAGES: readonly LessonStage[] = [
  {
    id: 'pieces',
    exercises: [
      { id: 'pieces-marshal', fen: fen({ e2: 'M' }), goal: targets('e3', 'f4', 'e5'), par: 3 },
      { id: 'pieces-general', fen: fen({ e2: 'G' }), goal: targets('e8', 'a8', 'b7'), par: 3 },
      { id: 'pieces-lieutenant', fen: fen({ e2: 'L' }), goal: targets('a6', 'b6', 'd8'), par: 3 },
      { id: 'pieces-major', fen: fen({ e2: 'J' }), goal: targets('f3', 'g3', 'g4'), par: 3 },
      { id: 'pieces-samurai', fen: fen({ e2: 'S' }), goal: targets('d3', 'd4', 'e5'), par: 3 },
      { id: 'pieces-lancer', fen: fen({ e2: 'N' }), goal: targets('e4', 'f5', 'f7'), par: 3 },
      { id: 'pieces-knight', fen: fen({ e2: 'R' }), goal: targets('e4', 'f4', 'f6'), par: 3 },
      { id: 'pieces-ninja', fen: fen({ e2: 'Y' }), goal: targets('g4', 'e6', 'c4'), par: 3 },
      { id: 'pieces-fortress', fen: fen({ e2: 'F' }), goal: targets('e3', 'f3', 'e2'), par: 3 },
      { id: 'pieces-soldier', fen: fen({ e2: 'P', e5: 'p' }), goal: targets('e5'), par: 3 },
      { id: 'pieces-tactician', fen: fen({ e2: 'T' }), goal: targets('f3', 'g4', 'g3'), par: 3 },
    ],
  },
  {
    id: 'towers',
    exercises: [
      { id: 'towers-stack', fen: fen({ e2: 'S', e3: 'P' }), goal: targets('e3'), par: 1 },
      { id: 'towers-reach', fen: fen({ e2: 'PS' }), goal: targets('e4'), par: 1 },
      { id: 'towers-reach-three', fen: fen({ e2: 'PPS' }), goal: targets('e5'), par: 1 },
      { id: 'towers-taller', fen: fen({ d2: 'S', d3: 'P', e4: 'pp' }), goal: targets('e4'), par: 2 },
    ],
  },
  {
    id: 'hand',
    exercises: [
      { id: 'hand-drop', fen: fen({ a3: 'P' }, { hands: 'P' }), goal: targets('e3'), par: 1 },
      { id: 'hand-zone', fen: fen({ a2: 'P' }, { hands: 'N' }), goal: targets('e4'), par: 2 },
      { id: 'hand-stack', fen: fen({ e3: 'P' }, { hands: 'S' }), goal: targets('e3'), par: 1 },
      { id: 'hand-attack', fen: fen({ a4: 'P', f5: 'p' }, { hands: 'S' }), goal: targets('f5'), par: 2 },
    ],
  },
  {
    id: 'jumpers',
    exercises: [
      { id: 'jumpers-cannon', fen: fen({ e1: 'C', e2: 'P', e3: 'p' }), goal: targets('e4'), par: 1 },
      { id: 'jumpers-musketeer', fen: fen({ e1: 'K', e2: 'p' }), goal: targets('e3', 'd2'), par: 2 },
      { id: 'jumpers-archer', fen: fen({ e1: 'A', d2: 'p', e2: 'p', f2: 'p' }), goal: targets('d3', 'e5'), par: 2 },
      { id: 'jumpers-tall', fen: fen({ e1: 'C', d1: 'P', d2: 'pp' }), goal: targets('d5'), par: 2 },
    ],
  },
  {
    id: 'betrayal',
    exercises: [
      { id: 'betrayal-move', fen: fen({ d2: 'T', e3: 'p' }, { hands: 'P' }), goal: { kind: 'betray', square: 'e3' }, par: 1 },
      { id: 'betrayal-drop', fen: fen({ e3: 'pP' }, { hands: 'TP' }), goal: { kind: 'betray', square: 'e3' }, par: 1 },
      { id: 'betrayal-tower', fen: fen({ d2: 'PT', e3: 'ps' }, { hands: 'PS' }), goal: { kind: 'betray', square: 'e3' }, par: 1 },
    ],
  },
  {
    id: 'marshal',
    exercises: [
      { id: 'marshal-escape', fen: fen({ e2: 'M', e6: 'g' }), goal: { kind: 'escape' }, par: 1 },
      { id: 'marshal-capture', fen: fen({ e2: 'M', d3: 'S', e4: 'n' }), goal: targets('e4'), par: 1 },
      { id: 'marshal-block', fen: fen({ e1: 'M', e7: 'g', a3: 'P' }, { hands: 'F' }), goal: targets('e3'), par: 1 },
    ],
  },
  {
    id: 'mate',
    exercises: [
      { id: 'mate-general', fen: '4m4/9/1G2L4/9/9/9/9/9/4M4 w - advanced p w', goal: { kind: 'mate', moves: 1 }, par: 1 },
      { id: 'mate-archer', fen: '5m3/9/9/5A1G1/9/9/9/9/4M4 w - advanced p w', goal: { kind: 'mate', moves: 1 }, par: 1 },
      { id: 'mate-corner', fen: '8m/9/9/4L2G1/9/9/9/9/4M4 w - advanced p w', goal: { kind: 'mate', moves: 1 }, par: 1 },
      { id: 'mate-two-cannon', fen: '4m4/G6C1/9/4N4/9/9/9/9/4M4 w - advanced p w', goal: { kind: 'mate', moves: 2 }, par: 2 },
      { id: 'mate-two-archer', fen: '9/4m4/9/9/1GN1A4/9/9/9/4M4 w - advanced p w', goal: { kind: 'mate', moves: 2 }, par: 2 },
    ],
  },
  {
    id: 'draft',
    exercises: [
      { id: 'draft-marshal', fen: '9/9/9/9/9/9/9/9/9 w MGL2J2S3N2R2Y2F4PC2AKTmgl2j2s3n2r2y2f4pc2akt advanced d w', goal: { kind: 'placeMarshal' }, par: 1 },
      { id: 'draft-place', fen: fen({ e1: 'M' }, { hands: 'GL2J2S3N2R2Y2F4PC2AKT', phase: 'd' }), goal: targets('d2', 'f2'), par: 2 },
      { id: 'draft-done', fen: fen({ e1: 'M', e9: 'm' }, { hands: 'G2S', phase: 'db', first: 'b' }), goal: { kind: 'finishDraft' }, par: 1 },
    ],
  },
];

export const LESSON_EXERCISES: readonly LessonExercise[] = LESSON_STAGES.flatMap((stage) => stage.exercises);

/** A lesson being played: the position, the starred squares reached so far and the moves made. */
export interface LessonState {
  readonly position: Position;
  readonly collected: readonly string[];
  readonly moves: number;
}

export const startLesson = (exercise: LessonExercise): LessonState => ({ position: parseFen(exercise.fen), collected: [], moves: 0 });

/**
 * The player's move. Outside mate exercises the opponent does not answer, so the turn comes straight back; in mate
 * exercises the page plays the defense.
 */
export const playLesson = (exercise: LessonExercise, state: LessonState, move: Move): LessonState => {
  const player = state.position.turn;
  const next = applyMove(state.position, move);
  const position = exercise.goal.kind === 'mate' || next.turn === player ? next : { ...next, turn: player };
  const goal = exercise.goal;
  const square = move.kind === 'done' ? null : squareName(move.to);
  const collected =
    goal.kind === 'targets' && square && goal.squares.includes(square) && !state.collected.includes(square) ? [...state.collected, square] : state.collected;
  return { position, collected, moves: state.moves + 1 };
};

/** Whether a non-mate exercise reached its goal; mate exercises end when the defender has no move. */
export const lessonDone = (exercise: LessonExercise, state: LessonState, player: Color): boolean => {
  const goal = exercise.goal;
  switch (goal.kind) {
    case 'targets':
      return goal.squares.every((square) => state.collected.includes(square));
    case 'escape':
      return state.moves > 0;
    case 'betray': {
      const tower = state.position.board[parseSquare(goal.square)!]!;
      const top = topOf(tower);
      return top?.role === 'tactician' && top.color === player && tower.every((piece) => piece.color === player) && tower.length > 1;
    }
    case 'placeMarshal':
      return findMarshal(state.position, player) !== undefined;
    case 'finishDraft':
      return state.position.phase === 'play';
    case 'mate':
      return false;
  }
};

/**
 * Stars for a finished exercise: three at par, two up to two moves over it, one beyond. In mate exercises, where the
 * moves are fixed, every wrong try costs a star.
 */
export const lessonStars = (exercise: LessonExercise, moves: number, mistakes: number): number => {
  if (exercise.goal.kind === 'mate') return Math.max(1, LESSON_STARS_MAX - mistakes);
  const extra = moves - exercise.par;
  return extra <= 0 ? 3 : extra <= 2 ? 2 : 1;
};

export const opponentOf = (exercise: LessonExercise): Color => opposite(parseFen(exercise.fen).turn);

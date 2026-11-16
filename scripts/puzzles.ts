/**
 * Generates the puzzles: the computer plays games against itself, and two kinds of positions become puzzles, each with
 * its solution line.
 *
 * - Mate: the side to move mates in 1 to 3 moves, every one attacking the Marshal (tsume), with a single first move.
 * - Material: one move wins material, clearly better than every other move at two search depths, and the line goes on
 *   while the solver keeps a single good move, until the material is won.
 *
 * Puzzles already in packages/protocol/src/puzzle-data.ts keep their ids, so running it again only adds new ones. The
 * file is written every few games, so a long run can be stopped without losing what it found.
 *
 *   node scripts/puzzles.ts [--games 100] [--seed 1] [--workers 4]
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Searcher, chooseMove, evaluateForSideToMove, longestDefense, mateDistance, mateSolutions } from '../packages/bot/src/index.ts';
import { VALUE } from '../packages/bot/src/search.ts';
import { Game, MODES, applyMove, initialPosition, isMarshalAttacked, moveToString, opposite, parseFen, toFen } from '../packages/engine/src/index.ts';
import type { Color, Position } from '../packages/engine/src/index.ts';
import { PUZZLES } from '../packages/protocol/src/puzzle-data.ts';
import type { Puzzle } from '../packages/protocol/src/puzzles.ts';

const MAX_MATE = 3;
const MAX_PLIES = 400;
/** A material puzzle wins at least this much (a bit over two Soldiers), and its move beats the second best by as much. */
const GAIN = 250;
const GAP = 250;
const MAX_SOLVER_MOVES = 3;
/** Plies skipped after a material puzzle, so one game does not give the same tactic twice. */
const MATERIAL_SPACING = 6;
const OUTPUT = new URL('../packages/protocol/src/puzzle-data.ts', import.meta.url);
const WRITE_EVERY = 5;

type Found = Omit<Puzzle, 'id'>;

const mateLine = (start: Position, moves: number): string[] => {
  const line: string[] = [];
  let position = start;
  for (let left = moves; left >= 1; left--) {
    const move = mateSolutions(position, left)[0]!;
    line.push(moveToString(move));
    position = applyMove(position, move);
    if (left === 1) break;
    const defense = longestDefense(position, left - 1)!;
    line.push(moveToString(defense));
    position = applyMove(position, defense);
  }
  return line;
};

const material = (position: Position, color: Color): number => {
  let total = 0;
  for (const tower of position.board) for (const piece of tower) total += (piece.color === color ? 1 : -1) * VALUE[piece.role];
  for (const side of ['white', 'black'] as const) {
    for (const [role, count] of Object.entries(position.hands[side])) total += (side === color ? 1 : -1) * count * VALUE[role as keyof typeof VALUE];
  }
  return total;
};

const analyser = new Searcher({ timeMs: Number.POSITIVE_INFINITY, maxDepth: 4 }, Math.random);

/** The best move when it beats every other one by `GAP` at depth 3, and stays first at depth 4. */
const singleBest = (position: Position, deep: boolean) => {
  const scores = analyser.analyse(position, 3);
  const [best, second] = scores;
  if (!best || !second || best.score - second.score < GAP) return null;
  if (deep) {
    const deeper = analyser.analyse(position, 4);
    if (moveToString(deeper[0]!.move) !== moveToString(best.move) || deeper[0]!.score - deeper[1]!.score < GAP * 0.8) return null;
  }
  return best;
};

/** A material puzzle from this position, or null: see the header for the conditions. */
const materialPuzzle = (position: Position, random: () => number): Found | null => {
  const base = evaluateForSideToMove(position);
  const quick = new Searcher({ timeMs: Number.POSITIVE_INFINITY, maxDepth: 2 }, random).choose(position);
  if (quick.score - base < GAIN || quick.score >= 90_000 || mateDistance(position, 2) !== null) return null;
  const first = singleBest(position, true);
  if (!first || first.score - base < GAIN || first.score >= 90_000) return null;
  const solver = position.turn;
  const before = material(position, solver);
  const line: string[] = [];
  let current = position;
  for (let step = 0; step < MAX_SOLVER_MOVES; step++) {
    const best = step === 0 ? first : singleBest(current, false);
    if (!best) return null;
    line.push(moveToString(best.move));
    current = applyMove(current, best.move);
    if (material(current, solver) - before >= GAIN) return { fen: toFen(position), line, kind: 'material' };
    const reply = new Searcher({ timeMs: Number.POSITIVE_INFINITY, maxDepth: 3 }, random).choose(current);
    line.push(moveToString(reply.move));
    current = applyMove(current, reply.move);
  }
  return null;
};

/** Plays one game and returns its puzzles: at most one mate of each length, material ones spaced out. */
const puzzlesOfGame = (index: number, seed: number): Found[] => {
  let state = (seed * 7919 + index * 104729) % 2147483647 || 1;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const game = new Game(initialPosition(MODES[index % MODES.length]!));
  const mates = new Map<number, Found>();
  const found: Found[] = [];
  let lastMaterial = -MATERIAL_SPACING;
  for (let ply = 0; ply < MAX_PLIES && !game.outcome; ply++) {
    const position = game.position;
    // A Marshal left attacked on the opponent's move only happens right after the draft: not a puzzle position.
    if (position.phase === 'play' && !isMarshalAttacked(position, opposite(position.turn))) {
      const moves = mateDistance(position, MAX_MATE);
      if (moves !== null) {
        if (!mates.has(moves) && mateSolutions(position, moves).length === 1) mates.set(moves, { fen: toFen(position), line: mateLine(position, moves), kind: 'mate' });
      } else if (ply - lastMaterial >= MATERIAL_SPACING) {
        const puzzle = materialPuzzle(position, random);
        if (puzzle) {
          found.push(puzzle);
          lastMaterial = ply;
        }
      }
    }
    game.play(chooseMove(position, random() < 0.5 ? 3 : 2, { random }));
  }
  return [...mates.values(), ...found];
};

const idOf = (fen: string): string => createHash('sha256').update(fen).digest('hex').slice(0, 8);

const write = (puzzles: readonly Puzzle[]): void => {
  const modeOf = (puzzle: Puzzle) => MODES.indexOf(parseFen(puzzle.fen).mode);
  const sorted = [...puzzles].sort((a, b) => modeOf(a) - modeOf(b) || a.line.length - b.line.length || a.id.localeCompare(b.id));
  const body = sorted.map((puzzle) => `  ${JSON.stringify(puzzle)},`).join('\n');
  writeFileSync(
    OUTPUT,
    `import type { Puzzle } from './puzzles.ts';\n\n` +
      `// Generated by scripts/puzzles.ts from games the computer played against itself. Do not edit by hand.\n` +
      `export const PUZZLES: readonly Puzzle[] = [\n${body}\n];\n`,
  );
};

if (isMainThread) {
  const { values } = parseArgs({ options: { games: { type: 'string', default: '100' }, seed: { type: 'string', default: '1' }, workers: { type: 'string' } } });
  const games = Number(values.games);
  const seed = Number(values.seed);
  const workers = Math.max(1, Math.min(games, Number(values.workers ?? Math.max(1, availableParallelism() - 1))));
  const known = new Map(PUZZLES.map((puzzle) => [puzzle.fen, puzzle]));
  const before = known.size;
  let done = 0;
  await Promise.all(
    Array.from({ length: workers }, (_, worker) =>
      new Promise<void>((resolve, reject) => {
        const indexes = Array.from({ length: games }, (_, i) => i).filter((i) => i % workers === worker);
        const thread = new Worker(new URL(import.meta.url), { workerData: { indexes, seed } });
        thread.on('message', (puzzles: Found[]) => {
          for (const puzzle of puzzles) if (!known.has(puzzle.fen)) known.set(puzzle.fen, { id: idOf(puzzle.fen), ...puzzle });
          done++;
          if (done % WRITE_EVERY === 0) write([...known.values()]);
          process.stdout.write(`\r${done}/${games} games, ${known.size - before} new puzzles`);
        });
        thread.on('error', reject);
        thread.on('exit', () => resolve());
      }),
    ),
  );
  write([...known.values()]);
  process.stdout.write(`\nWrote ${known.size} puzzles (${known.size - before} new).\n`);
} else {
  const { indexes, seed } = workerData as { indexes: number[]; seed: number };
  for (const index of indexes) parentPort!.postMessage(puzzlesOfGame(index, seed));
}

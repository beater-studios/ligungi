/**
 * Checks that every practice position can be done: the computer plays the player's side at a lower level against the
 * practice opponent at its strongest, a few times per position, and the report says how often the goal was reached.
 * A position that is never done here should be changed before it ships. It plays real games, so it takes a while.
 *
 *   node scripts/practice-check.ts [--runs 2] [--level 4] [--only <id>]
 */
import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { chooseMove, type BotLevel } from '../packages/bot/src/index.ts';
import { Game, parseFen, repetitionKey } from '../packages/engine/src/index.ts';
import { PRACTICE_LEVEL, PRACTICE_POSITIONS, practiceResult } from '../packages/content/src/practice.ts';

interface Job {
  readonly id: string;
  readonly run: number;
  readonly level: BotLevel;
}

interface Report {
  readonly id: string;
  readonly result: 'won' | 'failed';
  readonly moves: number;
  readonly outcome: string;
}

const play = ({ id, run, level }: Job): Report => {
  const practice = PRACTICE_POSITIONS.find((position) => position.id === id)!;
  const game = new Game(parseFen(practice.fen));
  const player = game.position.turn;
  let state = run * 7919 + 1;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const history: string[] = [];
  let playerMoves = 0;
  for (;;) {
    const position = game.position;
    const mover = position.turn === player ? level : (PRACTICE_LEVEL as BotLevel);
    game.play(chooseMove(position, mover, { random, history }));
    history.push(repetitionKey(position));
    if (position.turn === player) playerMoves++;
    const result = practiceResult(practice.goal, game.outcome ?? null, playerMoves, player);
    if (result !== 'playing') return { id, result, moves: playerMoves, outcome: game.outcome ? `${game.outcome.reason}` : 'limit' };
  }
};

if (isMainThread) {
  const { values } = parseArgs({ options: { runs: { type: 'string', default: '2' }, level: { type: 'string', default: '4' }, only: { type: 'string' } } });
  const level = Number(values.level) as BotLevel;
  const positions = PRACTICE_POSITIONS.filter((position) => !values.only || position.id === values.only);
  const jobs: Job[] = positions.flatMap((position) => Array.from({ length: Number(values.runs) }, (_, run) => ({ id: position.id, run, level })));
  const workers = Math.max(1, Math.min(jobs.length, availableParallelism() - 1));
  const reports: Report[] = [];
  await Promise.all(
    Array.from({ length: workers }, (_, worker) =>
      new Promise<void>((resolve, reject) => {
        const thread = new Worker(new URL(import.meta.url), { workerData: jobs.filter((_, i) => i % workers === worker) });
        thread.on('message', (report: Report) => {
          reports.push(report);
          process.stdout.write(`\r${reports.length}/${jobs.length} games`);
        });
        thread.on('error', reject);
        thread.on('exit', () => resolve());
      }),
    ),
  );
  process.stdout.write('\n');
  for (const position of positions) {
    const mine = reports.filter((report) => report.id === position.id);
    const won = mine.filter((report) => report.result === 'won').length;
    const details = mine.map((report) => `${report.result} in ${report.moves} (${report.outcome})`).join(', ');
    process.stdout.write(`${won === 0 ? 'NEVER' : 'ok   '} ${position.id.padEnd(28)} ${won}/${mine.length}  ${details}\n`);
  }
} else {
  for (const job of workerData as Job[]) parentPort!.postMessage(play(job));
}

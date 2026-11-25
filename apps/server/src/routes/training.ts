import type { AppDeps } from '../app.ts';
import { MODES, parseFen } from '@ligungi/engine';
import { EXPLORER_BANDS, EXPLORER_MODES, LESSON_EXERCISES, LESSON_PROGRESS_BATCH, LESSON_STARS_MAX, PRACTICE_BATCH, PRACTICE_POSITIONS, PUZZLE_BATCH, PUZZLE_RUN_BATCH, PUZZLE_RUN_KINDS, PUZZLE_THEMES, type PuzzleRun } from '@ligungi/protocol';
import { HttpError, sendJson, type Router } from '../http.ts';
import { requireUser } from './guards.ts';
import { isPuzzle, PUZZLE_COUNT } from '../puzzles.ts';

const LESSON_IDS: ReadonlySet<string> = new Set(LESSON_EXERCISES.map((exercise) => exercise.id));
const PRACTICE_IDS: ReadonlySet<string> = new Set(PRACTICE_POSITIONS.map((position) => position.id));

/** Training: lessons, practice, the draft explorer, puzzles, puzzle runs and Puzzle Racer. */
export const registerTrainingRoutes = (router: Router, deps: AppDeps): void => {
  const { activityCaller, config, explorer, puzzles, raceLimiter, racers, users } = deps;
  router
    .add('GET', '/api/lessons/progress', (ctx) => sendJson(ctx.res, 200, users.training.lessonProgress(requireUser(ctx))))
    .add('POST', '/api/lessons/progress', async (ctx) => {
      const userId = requireUser(ctx);
      const { results } = (await ctx.body()) as { results?: unknown };
      const entries = typeof results === 'object' && results !== null && !Array.isArray(results) ? Object.entries(results) : null;
      const valid =
        entries !== null &&
        entries.length <= LESSON_PROGRESS_BATCH &&
        entries.every(([id, stars]) => LESSON_IDS.has(id) && Number.isInteger(stars) && (stars as number) >= 1 && (stars as number) <= LESSON_STARS_MAX);
      if (!valid) throw new HttpError('invalidLessonProgress');
      users.training.saveLessonProgress(userId, Object.fromEntries(entries) as Record<string, number>);
      sendJson(ctx.res, 200, users.training.lessonProgress(userId));
    })
    .add('GET', '/api/explorer', (ctx) => {
      const params = ctx.url.searchParams;
      const mode = EXPLORER_MODES.find((value) => value === params.get('mode'));
      if (!mode) throw new HttpError('invalidMode');
      const band = EXPLORER_BANDS.find((value) => value === (params.get('band') ?? 'all'));
      if (!band) throw new HttpError('invalidExplorerQuery');
      const fen = params.get('fen');
      if (fen !== null) {
        let position;
        try {
          position = parseFen(fen);
        } catch {
          throw new HttpError('invalidExplorerQuery');
        }
        if (position.phase !== 'draft' || position.mode !== mode) throw new HttpError('invalidExplorerQuery');
      }
      sendJson(ctx.res, 200, explorer.query(mode, band, params.get('rated') === '1', fen));
    })
    .add('GET', '/api/practice/progress', (ctx) => sendJson(ctx.res, 200, users.training.practiceProgress(requireUser(ctx))))
    .add('POST', '/api/practice/progress', async (ctx) => {
      const userId = requireUser(ctx);
      const { results } = (await ctx.body()) as { results?: unknown };
      const entries = typeof results === 'object' && results !== null && !Array.isArray(results) ? Object.entries(results) : null;
      const valid =
        entries !== null &&
        entries.length <= PRACTICE_BATCH &&
        entries.every(([id, moves]) => PRACTICE_IDS.has(id) && Number.isInteger(moves) && (moves as number) >= 1 && (moves as number) <= 1000);
      if (!valid) throw new HttpError('invalidPracticeProgress');
      users.training.savePracticeProgress(userId, Object.fromEntries(entries) as Record<string, number>);
      sendJson(ctx.res, 200, users.training.practiceProgress(userId));
    })
    .add('GET', '/api/puzzles/next', (ctx) => {
      const params = ctx.url.searchParams;
      const theme = PUZZLE_THEMES.find((value) => value === params.get('theme')) ?? null;
      const mode = MODES.find((value) => value === params.get('mode')) ?? null;
      // Without an account, the browser says what it already solved (ids that are not puzzles are ignored).
      const exclude = (params.get('exclude') ?? '').split(',').filter(isPuzzle).slice(0, PUZZLE_BATCH);
      const id = puzzles.next(ctx.session.userId, { theme, mode }, exclude);
      if (!id) throw new HttpError('noPuzzleLeft');
      sendJson(ctx.res, 200, { id });
    })
    .add('GET', '/api/puzzles/daily', (ctx) => {
      sendJson(ctx.res, 200, puzzles.daily(new Date(config.now()).toISOString().slice(0, 10)));
    })
    .add('GET', '/api/puzzles/dashboard', (ctx) => sendJson(ctx.res, 200, puzzles.dashboard(requireUser(ctx))))
    .add('GET', '/api/puzzles/solved', (ctx) => sendJson(ctx.res, 200, puzzles.solved(requireUser(ctx))))
    .add('POST', '/api/puzzles/solved', async (ctx) => {
      const userId = requireUser(ctx);
      const { ids } = (await ctx.body()) as { ids?: unknown };
      if (!Array.isArray(ids) || ids.length > PUZZLE_BATCH || !ids.every((id) => typeof id === 'string' && isPuzzle(id))) {
        throw new HttpError('invalidPuzzle');
      }
      puzzles.importSolved(userId, ids as string[]);
      sendJson(ctx.res, 200, puzzles.solved(userId));
    })
    .add('GET', '/api/racer', (ctx) => {
      const userId = ctx.session.userId;
      sendJson(ctx.res, 200, { records: userId ? racers.records(userId) : null, waiting: racers.waiting() });
    })
    .add('POST', '/api/racer/public', (ctx) => {
      if (!raceLimiter.allow(ctx.session.id)) throw new HttpError('tooManyAttempts');
      sendJson(ctx.res, 200, { id: racers.joinPublic(ctx.player) });
    })
    .add('POST', '/api/racer', (ctx) => {
      if (!raceLimiter.allow(ctx.session.id)) throw new HttpError('tooManyAttempts');
      sendJson(ctx.res, 200, { id: racers.create(ctx.player, 'friends') });
    })
    .add('GET', '/api/racer/:id', (ctx) => {
      const race = racers.view(ctx.params.id!, ctx.player);
      if (!race) throw new HttpError('raceNotFound');
      sendJson(ctx.res, 200, race);
    })
    .add('POST', '/api/racer/:id/join', async (ctx) => {
      if (!raceLimiter.allow(ctx.session.id)) throw new HttpError('tooManyAttempts');
      const body = (await ctx.body()) as { instanceId?: unknown };
      // A call's race is only for the people in that call.
      const instanceId = body.instanceId === undefined ? null : await activityCaller(ctx, body.instanceId);
      const joined = racers.join(ctx.params.id!, ctx.player, instanceId);
      if (joined) throw new HttpError(joined);
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/racer/:id/start', (ctx) => {
      const started = racers.start(ctx.params.id!, ctx.player);
      if (started) throw new HttpError(started);
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('GET', '/api/puzzles/sequence', (ctx) => {
      const kind = PUZZLE_RUN_KINDS.find((value) => value === ctx.url.searchParams.get('kind'));
      if (!kind) throw new HttpError('invalidPuzzleRun');
      sendJson(ctx.res, 200, { ids: puzzles.sequence(kind) });
    })
    .add('GET', '/api/puzzles/runs', (ctx) => sendJson(ctx.res, 200, puzzles.runs(requireUser(ctx))))
    .add('POST', '/api/puzzles/runs', async (ctx) => {
      const userId = requireUser(ctx);
      const { runs } = (await ctx.body()) as { runs?: unknown };
      const latest = config.now() + 60_000;
      const valid =
        Array.isArray(runs) &&
        runs.length <= PUZZLE_RUN_BATCH &&
        runs.every((run: unknown) => {
          if (typeof run !== 'object' || run === null) return false;
          const { kind, score, at } = run as Record<string, unknown>;
          return (
            PUZZLE_RUN_KINDS.some((value) => value === kind) &&
            Number.isInteger(score) &&
            (score as number) >= 0 &&
            (score as number) <= PUZZLE_COUNT &&
            Number.isInteger(at) &&
            (at as number) >= 0 &&
            (at as number) <= latest
          );
        });
      if (!valid) throw new HttpError('invalidPuzzleRun');
      puzzles.saveRuns(userId, runs as PuzzleRun[]);
      sendJson(ctx.res, 200, puzzles.runs(userId));
    })
    .add('GET', '/api/puzzles/:id', (ctx) => {
      if (!isPuzzle(ctx.params.id!)) throw new HttpError('puzzleNotFound');
      sendJson(ctx.res, 200, puzzles.view(ctx.params.id!, ctx.session.userId));
    })
    .add('POST', '/api/puzzles/:id/attempt', async (ctx) => {
      const userId = requireUser(ctx);
      if (!isPuzzle(ctx.params.id!)) throw new HttpError('puzzleNotFound');
      const { win } = (await ctx.body()) as { win?: unknown };
      if (typeof win !== 'boolean') throw new HttpError('invalidPuzzle');
      sendJson(ctx.res, 200, puzzles.attempt(userId, ctx.params.id!, win));
    });
};

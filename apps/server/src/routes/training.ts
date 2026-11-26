import type { AppDeps } from '../app.ts';
import { MODES, parseFen } from '@ligungi/engine';
import { isErrorCode, parseLessonProgress, parsePracticeProgress, parsePuzzleRuns, EXPLORER_BANDS, EXPLORER_MODES, PUZZLE_BATCH, PUZZLE_RUN_KINDS } from '@ligungi/protocol';
import { PUZZLE_THEMES } from '@ligungi/content';
import { HttpError, sendJson, type Router } from '../http.ts';
import { requireUser } from './guards.ts';
import { isPuzzle, PUZZLE_COUNT } from '../puzzles.ts';

/** Training: lessons, practice, the draft explorer, puzzles, puzzle runs and Puzzle Racer. */
export const registerTrainingRoutes = (router: Router, deps: AppDeps): void => {
  const { activityCaller, config, explorer, puzzles, raceLimiter, racers, users } = deps;
  router
    .add('GET', '/api/lessons/progress', (ctx) => sendJson(ctx.res, 200, users.training.lessonProgress(requireUser(ctx))))
    .add('POST', '/api/lessons/progress', async (ctx) => {
      const userId = requireUser(ctx);
      const { results } = (await ctx.body()) as { results?: unknown };
      const progress = parseLessonProgress(results);
      if (isErrorCode(progress)) throw new HttpError(progress);
      users.training.saveLessonProgress(userId, progress);
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
      const progress = parsePracticeProgress(results);
      if (isErrorCode(progress)) throw new HttpError(progress);
      users.training.savePracticeProgress(userId, progress);
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
      const parsed = parsePuzzleRuns(runs, PUZZLE_COUNT, config.now() + 60_000);
      if (isErrorCode(parsed)) throw new HttpError(parsed);
      puzzles.saveRuns(userId, parsed);
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

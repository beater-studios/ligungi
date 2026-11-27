import type { AppDeps } from '../app.ts';
import { HttpError, sendJson, type Context, type Router } from '../http.ts';
import { requireUser } from './guards.ts';

/** The weekly Arena: the current and recent ones, the seasons, one Arena's page, joining and pausing, and a player's trophies. */
export const registerArenaRoutes = (router: Router, deps: AppDeps): void => {
  const { arenaLimiter, arenas, findUser } = deps;

  const act = (ctx: Context, action: 'join' | 'pause') => {
    const userId = requireUser(ctx);
    if (!arenaLimiter.allow(ctx.session.id)) throw new HttpError('tooManyAttempts');
    const id = ctx.params.id!;
    const error = action === 'join' ? arenas.join(id, userId) : arenas.pause(id, userId);
    if (error) throw new HttpError(error);
    sendJson(ctx.res, 200, arenas.view(id, userId));
  };

  router
    .add('GET', '/api/arena', (ctx) => sendJson(ctx.res, 200, arenas.list(ctx.session.userId)))
    // Before `/api/arena/:id`, which would take `season` for an Arena id.
    .add('GET', '/api/arena/season', (ctx) => sendJson(ctx.res, 200, arenas.season(arenas.currentSeason())))
    .add('GET', '/api/arena/season/:season', (ctx) => {
      const season = arenas.season(ctx.params.season!);
      if (!season) throw new HttpError('seasonNotFound');
      sendJson(ctx.res, 200, season);
    })
    .add('GET', '/api/arena/:id', (ctx) => {
      const arena = arenas.view(ctx.params.id!, ctx.session.userId);
      if (!arena) throw new HttpError('arenaNotFound');
      sendJson(ctx.res, 200, arena);
    })
    .add('POST', '/api/arena/:id/join', (ctx) => act(ctx, 'join'))
    .add('POST', '/api/arena/:id/pause', (ctx) => act(ctx, 'pause'))
    .add('GET', '/api/users/:name/arenas', (ctx) => sendJson(ctx.res, 200, arenas.playerArenas(findUser(ctx.params.name!).id)));
};

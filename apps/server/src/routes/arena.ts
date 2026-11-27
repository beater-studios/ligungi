import type { AppDeps } from '../app.ts';
import { HttpError, sendJson, type Context, type Router } from '../http.ts';
import { requireUser } from './guards.ts';

/** The weekly Arena: the current and recent ones, one Arena's page, joining and pausing, and a player's trophies. */
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
    .add('GET', '/api/arena/:id', (ctx) => {
      const arena = arenas.view(ctx.params.id!, ctx.session.userId);
      if (!arena) throw new HttpError('arenaNotFound');
      sendJson(ctx.res, 200, arena);
    })
    .add('POST', '/api/arena/:id/join', (ctx) => act(ctx, 'join'))
    .add('POST', '/api/arena/:id/pause', (ctx) => act(ctx, 'pause'))
    .add('GET', '/api/users/:name/arenas', (ctx) => sendJson(ctx.res, 200, arenas.playerArenas(findUser(ctx.params.name!).id)));
};

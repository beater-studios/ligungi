import type { AppDeps } from '../app.ts';
import { BOOKMARK_NOTE_MAX, DAY_MS, dayStart, isErrorCode, parseGameSearch, parseSettings, type GameSearchResult, type UserRef } from '@ligungi/protocol';
import { BUILD } from '../build.ts';
import { exportGame } from '../game-export.ts';
import type { SearchCriteria } from '../game-history.ts';
import { HttpError, sendJson, sendText, type Router } from '../http.ts';
import { requireUser } from './guards.ts';

const SITE_NAME = 'ligungi';

/** Games: the lobby, seeks, challenges, game pages, the TV, bookmarks and search; also the health and version checks. */
export const registerPlayRoutes = (router: Router, deps: AppDeps): void => {
  const { db, games, hub, lobby, lobbyView, searchLimiter, sendIncoming, tv, tvGames, users } = deps;
  router
    .add('GET', '/api/health', (ctx) => {
      try {
        db.prepare('select 1').get();
        sendJson(ctx.res, 200, { ok: true, ...BUILD });
      } catch {
        sendJson(ctx.res, 503, { ok: false, ...BUILD });
      }
    })
    .add('GET', '/api/bookmarks', (ctx) => sendJson(ctx.res, 200, games.bookmarks(requireUser(ctx))))
    .add('GET', '/api/games/:id/bookmark', (ctx) => {
      const userId = requireUser(ctx);
      if (!games.exists(ctx.params.id!)) throw new HttpError('gameNotFound');
      sendJson(ctx.res, 200, games.bookmark(userId, ctx.params.id!));
    })
    .add('POST', '/api/games/:id/bookmark', async (ctx) => {
      const userId = requireUser(ctx);
      if (!games.exists(ctx.params.id!)) throw new HttpError('gameNotFound');
      const { note = '' } = (await ctx.body()) as { note?: unknown };
      if (typeof note !== 'string' || note.length > BOOKMARK_NOTE_MAX) throw new HttpError('invalidBookmarkNote');
      sendJson(ctx.res, 200, games.saveBookmark(userId, ctx.params.id!, note.trim()));
    })
    .add('DELETE', '/api/games/:id/bookmark', (ctx) => {
      const userId = requireUser(ctx);
      if (!games.exists(ctx.params.id!)) throw new HttpError('gameNotFound');
      sendJson(ctx.res, 200, games.removeBookmark(userId, ctx.params.id!));
    })
    .add('GET', '/api/games/search', (ctx) => {
      if (!searchLimiter.allow(ctx.session.id)) throw new HttpError('tooManyAttempts');
      const search = parseGameSearch(ctx.url.searchParams);
      if (isErrorCode(search)) throw new HttpError(search);
      const { player, vs, from, to, page, ...rest } = search;
      const playerId = player ? users.findByName(player)?.id : undefined;
      const vsId = vs ? users.findByName(vs)?.id : undefined;
      const empty: GameSearchResult = { games: [], more: false };
      // An unknown name matches no game, the same as a known one with no games.
      if ((player && !playerId) || (vs && !vsId)) return sendJson(ctx.res, 200, empty);
      const criteria: SearchCriteria = {
        ...rest,
        ...(playerId ? { playerId } : {}),
        ...(vsId ? { vsId } : {}),
        ...(from ? { from: dayStart(from)! } : {}),
        ...(to ? { to: dayStart(to)! + DAY_MS } : {}),
      };
      sendJson(ctx.res, 200, games.history.search(criteria, page ?? 1));
    })
    .add('GET', '/api/games/:id', (ctx) => {
      const room = games.get(ctx.params.id!);
      if (!room) throw new HttpError('gameNotFound');
      sendJson(ctx.res, 200, room.view(ctx.session.id, ctx.session.userId));
    })
    .add('GET', '/api/games/:id/export', (ctx) => {
      const room = games.get(ctx.params.id!);
      if (!room) throw new HttpError('gameNotFound');
      const origin = `${ctx.req.headers['x-forwarded-proto'] ?? 'http'}://${ctx.req.headers.host ?? SITE_NAME}`;
      sendText(ctx.res, 200, exportGame(room, origin));
    })
    .add('GET', '/api/tv', (ctx) => sendJson(ctx.res, 200, tvGames()))
    .add('GET', '/api/tv/channels', (ctx) => sendJson(ctx.res, 200, tv.channels()))
    .add('GET', '/api/version', (ctx) => sendJson(ctx.res, 200, BUILD))
    .add('GET', '/api/lobby', (ctx) => sendJson(ctx.res, 200, lobbyView(ctx.player)))
    .add('POST', '/api/seeks', async (ctx) => {
      const settings = parseSettings(await ctx.body());
      if (isErrorCode(settings)) throw new HttpError(settings);
      const result = lobby.createSeek(ctx.player, settings, hub.hasSession(ctx.session.id));
      if (isErrorCode(result)) throw new HttpError(result);
      sendJson(ctx.res, 200, result);
    })
    .add('POST', '/api/seeks/:id/accept', (ctx) => {
      const result = lobby.acceptSeek(ctx.params.id!, ctx.player);
      if (isErrorCode(result)) throw new HttpError(result);
      sendJson(ctx.res, 200, result);
    })
    .add('DELETE', '/api/seeks/:id', (ctx) => {
      if (!lobby.cancelSeek(ctx.params.id!, ctx.player)) throw new HttpError('seekNotFound');
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/challenges', async (ctx) => {
      const body = await ctx.body();
      const settings = parseSettings(body);
      if (isErrorCode(settings)) throw new HttpError(settings);
      const to = (body as { to?: unknown }).to;
      let destination: UserRef | null = null;
      if (to !== undefined) {
        // A challenge from a profile: the sender needs an account and a live connection (it is withdrawn when they leave).
        const userId = requireUser(ctx);
        const target = typeof to === 'string' ? users.findByName(to) : undefined;
        if (!target) throw new HttpError('userNotFound');
        if (target.id === userId) throw new HttpError('cannotChallengeSelf');
        if (!users.social.canChallenge(userId, target.id)) throw new HttpError('challengeRefused');
        if (!hub.hasSession(ctx.session.id)) throw new HttpError('connectionRequired');
        destination = { id: target.id, name: target.name };
      }
      const challenge = lobby.createChallenge(ctx.player, settings, destination);
      if (isErrorCode(challenge)) throw new HttpError(challenge);
      if (destination) sendIncoming(destination.id);
      sendJson(ctx.res, 200, lobby.challengeView(challenge, ctx.player));
    })
    .add('POST', '/api/challenges/:id/decline', (ctx) => {
      if (!lobby.declineChallenge(ctx.params.id!, ctx.player)) throw new HttpError('challengeNotFound');
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('GET', '/api/challenges/:id', (ctx) => {
      const challenge = lobby.challenge(ctx.params.id!);
      if (!challenge) throw new HttpError('challengeNotFound');
      sendJson(ctx.res, 200, lobby.challengeView(challenge, ctx.player));
    })
    .add('POST', '/api/challenges/:id/accept', (ctx) => {
      const result = lobby.acceptChallenge(ctx.params.id!, ctx.player);
      if (isErrorCode(result)) throw new HttpError(result);
      sendJson(ctx.res, 200, result);
    })
    .add('DELETE', '/api/challenges/:id', (ctx) => {
      if (!lobby.cancelChallenge(ctx.params.id!, ctx.player)) throw new HttpError('challengeNotFound');
      sendJson(ctx.res, 200, { ok: true });
    });
};

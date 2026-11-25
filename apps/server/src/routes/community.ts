import type { AppDeps } from '../app.ts';
import { MODES, type Mode } from '@ligungi/engine';
import { ACTIVITY_DAYS, ACTIVITY_MAX, DAY_MS, FEED_DAYS, FEED_MAX, isErrorCode, LEADERBOARD_MAX, LEADERBOARD_TOP, MAX_BLOCKS, MAX_FOLLOWS, parseGameFilters, type ActivityEvent, type ActivityView, type FeedItem, type FriendView, type Leaderboard, type UserProfile, type UserRef, type UserSearchResult } from '@ligungi/protocol';
import { HttpError, sendJson, type Router } from '../http.ts';

/** Players found by the name search. */
const SEARCH_LIMIT = 10;

/** Players: profiles, stats, games, the feed, follows, blocks, the players page, the ranking and the leaderboards. */
export const registerCommunityRoutes = (router: Router, deps: AppDeps): void => {
  const { config, findUser, games, leaders, lobby, notice, onlineUsers, playersView, playingByUser, puzzles, rankingView, requireUser, searchLimiter, studies, users } = deps;
  router
    .add('GET', '/api/users', (ctx) => {
      const query = ctx.url.searchParams.get('q')?.trim() ?? '';
      if (!/^[A-Za-z0-9_-]{2,20}$/.test(query)) return sendJson(ctx.res, 200, []);
      const online = onlineUsers(ctx.session.userId);
      const results: UserSearchResult[] = users
        .search(query, SEARCH_LIMIT)
        .map((user) => ({ user, online: online.has(user.id) }));
      sendJson(ctx.res, 200, results);
    })
    .add('GET', '/api/users/:name', (ctx) => {
      const user = findUser(ctx.params.name!);
      const profile: UserProfile = {
        user: { id: user.id, name: user.name },
        createdAt: user.createdAt,
        online: onlineUsers(ctx.session.userId).has(user.id),
        ratings: users.ratings(user.id),
        ranks: Object.fromEntries(MODES.map((mode) => [mode, users.rank(user.id, mode)])) as Record<Mode, number | null>,
        counts: games.counts(user.id),
        records: games.records(user.id),
        ...users.followCounts(user.id),
        followed: ctx.session.userId ? users.isFollowing(ctx.session.userId, user.id) : false,
        blocked: ctx.session.userId ? users.hasBlocked(ctx.session.userId, user.id) : false,
        canChallenge: ctx.session.userId ? users.canChallenge(ctx.session.userId, user.id) : false,
        canFollow: ctx.session.userId ? users.canFollow(ctx.session.userId, user.id) : false,
        details: users.details(user.id),
        playing: games.ongoing().filter((room) => room.colorOf('', user.id)).map((room) => room.summary()),
        recent: games.recentFor(user.id, 20),
      };
      sendJson(ctx.res, 200, profile);
    })
    .add('GET', '/api/users/:name/stats/:mode', (ctx) => {
      const user = findUser(ctx.params.name!);
      const mode = ctx.params.mode as Mode;
      if (!MODES.includes(mode)) throw new HttpError(404, 'invalidMode');
      sendJson(ctx.res, 200, games.modeStats(user.id, mode));
    })
    .add('GET', '/api/users/:name/games', (ctx) => {
      const user = findUser(ctx.params.name!);
      const filters = parseGameFilters(ctx.url.searchParams);
      if (isErrorCode(filters)) throw new HttpError(400, filters);
      const { vs, ...rest } = filters;
      let vsId: string | undefined;
      if (vs) {
        const opponent = users.findByName(vs);
        if (!opponent) return sendJson(ctx.res, 200, []);
        vsId = opponent.id;
      }
      const before = Number(ctx.url.searchParams.get('before')) || undefined;
      sendJson(ctx.res, 200, games.recentFor(user.id, 20, before, { ...rest, ...(vsId ? { vsId } : {}) }));
    })
    .add('GET', '/api/crosstable/:a/:b', (ctx) => {
      // Only id and name leave the server: the stored user also holds the password hash.
      const [a, b] = [findUser(ctx.params.a!), findUser(ctx.params.b!)].map((user) => ({ id: user.id, name: user.name })) as [UserRef, UserRef];
      if (a.id === b.id) throw new HttpError(400, 'invalidFilter');
      sendJson(ctx.res, 200, games.crosstable(a, b));
    })
    .add('GET', '/api/users/:name/activity', (ctx) => {
      const user = findUser(ctx.params.name!);
      const mine = ctx.session.userId === user.id;
      const since = config.now() - ACTIVITY_DAYS * DAY_MS;
      const events: ActivityEvent[] = [
        ...games.activityGames([user.id], since, ACTIVITY_MAX).map(({ at, game }): ActivityEvent => ({ kind: 'game', at, game })),
        ...studies.createdBy([user.id], since, ACTIVITY_MAX).map(({ id, title, at }): ActivityEvent => ({ kind: 'study', at, study: { id, title } })),
        ...(user.createdAt >= since ? [{ kind: 'joined', at: user.createdAt } as const] : []),
        ...(mine ? [...puzzles.activitySince(user.id, since), ...users.trainingSince(user.id, since)] : []),
      ];
      const view: ActivityView = { events: events.sort((a, b) => b.at - a.at).slice(0, ACTIVITY_MAX), mine };
      sendJson(ctx.res, 200, view);
    })
    .add('GET', '/api/users/:name/insights/:mode', (ctx) => {
      if (!searchLimiter.allow(ctx.session.id)) throw new HttpError(429, 'tooManyAttempts');
      const user = findUser(ctx.params.name!);
      const mode = ctx.params.mode as Mode;
      if (!(MODES as readonly string[]).includes(mode)) throw new HttpError(400, 'invalidMode');
      sendJson(ctx.res, 200, games.insights(user.id, mode));
    })
    .add('GET', '/api/feed', (ctx) => {
      const userId = requireUser(ctx);
      const names = new Map(users.following(userId).map((user) => [user.id, user.name]));
      const followed = [...names.keys()];
      const since = config.now() - FEED_DAYS * DAY_MS;
      // A game between two followed players is told once, from the side of the first one found.
      const seen = new Set<string>();
      const played = games.activityGames(followed, since, FEED_MAX * 2).filter(({ game }) => !seen.has(game.id) && Boolean(seen.add(game.id)));
      const items: FeedItem[] = [
        ...played.map(({ userId: id, at, game }): FeedItem => ({ user: { id, name: names.get(id) ?? '' }, event: { kind: 'game', at, game } })),
        ...studies
          .createdBy(followed, since, FEED_MAX)
          .map(({ ownerId, ownerName, id, title, at }): FeedItem => ({ user: { id: ownerId, name: ownerName }, event: { kind: 'study', at, study: { id, title } } })),
      ];
      sendJson(ctx.res, 200, items.sort((a, b) => b.event.at - a.event.at).slice(0, FEED_MAX));
    })
    .add('GET', '/api/users/:name/counts', (ctx) => {
      const user = findUser(ctx.params.name!);
      const filters = parseGameFilters(ctx.url.searchParams);
      if (isErrorCode(filters)) throw new HttpError(400, filters);
      let vsId: string | undefined;
      if (filters.vs) {
        const opponent = users.findByName(filters.vs);
        if (!opponent) return sendJson(ctx.res, 200, { games: 0, rated: 0, wins: 0, losses: 0, draws: 0 });
        vsId = opponent.id;
      }
      sendJson(
        ctx.res,
        200,
        games.counts(user.id, { ...(filters.mode ? { mode: filters.mode } : {}), ...(filters.color ? { color: filters.color } : {}), ...(vsId ? { vsId } : {}) }),
      );
    })
    .add('POST', '/api/users/:name/follow', (ctx) => {
      const userId = requireUser(ctx);
      const target = findUser(ctx.params.name!);
      if (target.id === userId) throw new HttpError(400, 'cannotFollowSelf');
      if (!users.isFollowing(userId, target.id) && users.followCounts(userId).following >= MAX_FOLLOWS) {
        throw new HttpError(400, 'tooManyFollows');
      }
      if (!users.isFollowing(userId, target.id) && !users.canFollow(userId, target.id)) throw new HttpError(403, 'followRefused');
      if (users.follow(userId, target.id)) notice(target.id, 'follow', { actorId: userId });
      sendJson(ctx.res, 200, { followed: true, canFollow: true, ...users.followCounts(target.id) });
    })
    .add('DELETE', '/api/users/:name/follow', (ctx) => {
      const userId = requireUser(ctx);
      const target = findUser(ctx.params.name!);
      users.unfollow(userId, target.id);
      sendJson(ctx.res, 200, { followed: false, canFollow: users.canFollow(userId, target.id), ...users.followCounts(target.id) });
    })
    .add('POST', '/api/users/:name/block', (ctx) => {
      const userId = requireUser(ctx);
      const target = findUser(ctx.params.name!);
      if (target.id === userId) throw new HttpError(400, 'cannotBlockSelf');
      if (!users.hasBlocked(userId, target.id) && users.blockCount(userId) >= MAX_BLOCKS) throw new HttpError(409, 'tooManyBlocks');
      users.block(userId, target.id);
      lobby.cancelBetween(userId, target.id);
      sendJson(ctx.res, 200, { blocked: true, followed: false, canFollow: false, canChallenge: false, ...users.followCounts(target.id) });
    })
    .add('DELETE', '/api/users/:name/block', (ctx) => {
      const userId = requireUser(ctx);
      const target = findUser(ctx.params.name!);
      users.unblock(userId, target.id);
      sendJson(ctx.res, 200, {
        blocked: false,
        followed: false,
        canFollow: users.canFollow(userId, target.id),
        canChallenge: users.canChallenge(userId, target.id),
        ...users.followCounts(target.id),
      });
    })
    .add('GET', '/api/following', (ctx) => {
      const userId = requireUser(ctx);
      const online = onlineUsers(userId);
      const playing = playingByUser();
      const list: FriendView[] = users.following(userId).map((user) => ({
        user,
        online: online.has(user.id),
        playing: playing.get(user.id) ?? null,
        ratings: users.ratings(user.id),
        canChallenge: users.canChallenge(userId, user.id),
      }));
      sendJson(ctx.res, 200, list);
    })
    .add('GET', '/api/players', (ctx) => sendJson(ctx.res, 200, playersView(ctx.session.userId, ctx.session.id)))
    .add('GET', '/api/ranking', (ctx) => sendJson(ctx.res, 200, rankingView(null, ctx.url.searchParams, ctx.session.userId)))
    .add('GET', '/api/ranking/:mode', (ctx) => {
      const mode = ctx.params.mode as Mode;
      if (!MODES.includes(mode)) throw new HttpError(404, 'invalidMode');
      sendJson(ctx.res, 200, rankingView(mode, ctx.url.searchParams, ctx.session.userId));
    })
    .add('GET', '/api/leaderboard', (ctx) => {
      const online = onlineUsers(ctx.session.userId);
      const board = Object.fromEntries(MODES.map((mode) => [mode, leaders(mode, LEADERBOARD_TOP, online)])) as unknown as Leaderboard;
      sendJson(ctx.res, 200, board);
    })
    .add('GET', '/api/leaderboard/:mode', (ctx) => {
      const mode = ctx.params.mode as Mode;
      if (!MODES.includes(mode)) throw new HttpError(404, 'invalidMode');
      const limit = Math.min(LEADERBOARD_MAX, Math.max(1, Math.trunc(Number(ctx.url.searchParams.get('limit'))) || LEADERBOARD_MAX));
      sendJson(ctx.res, 200, leaders(mode, limit, onlineUsers(ctx.session.userId)));
    });
};

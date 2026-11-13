import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { MODES, type Color, type Mode } from '@ligungi/engine';
import {
  ERROR_MESSAGES,
  LEADERBOARD_MAX,
  LEADERBOARD_TOP,
  MAX_FOLLOWS,
  isErrorCode,
  parseClientMessage,
  parseGameFilters,
  type FriendView,
  type LeaderEntry,
  type Leaderboard,
  type ErrorCode,
  parseSettings,
  type ClientMessage,
  type LobbyView,
  type Me,
  type Topic,
  type UserProfile,
  type SessionView,
  type UserSearchResult,
} from '@ligungi/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  SESSION_COOKIE,
  Sessions,
  hashPassword,
  needsRehash,
  parseCookies,
  sessionCookie,
  sessionHandle,
  verifyPassword,
  type Session,
} from './auth.ts';
import { BUILD } from './build.ts';
import type { ServerConfig } from './config.ts';
import { openDatabase, type Db } from './db.ts';
import { exportGame } from './export.ts';
import { Games, type Player } from './games.ts';
import { randomId } from './ids.ts';
import {
  HttpError,
  RateLimiter,
  Router,
  clientIp,
  readJson,
  sendError,
  sendJson,
  sendText,
  serveStatic,
  type Context,
} from './http.ts';
import { Hub, type Client } from './hub.ts';
import { Lobby } from './lobby.ts';
import type { GameRoom } from './room.ts';
import { USERNAME_PATTERN, Users } from './users.ts';

/** Stored name of players without an account; the site shows a translated label instead. */
export const ANONYMOUS_NAME = 'Anonymous';
const HEARTBEAT_MS = 30_000;
const SESSION_SWEEP_MS = 6 * 3_600_000;
const MAX_TOPICS_PER_CLIENT = 32;
const SEARCH_LIMIT = 10;
const SITE_NAME = 'ligungi';
/** Cloudflare Web Analytics: no cookies, aggregate only; its edge injects this script into the HTML. */
const ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const ANALYTICS_REPORT = 'https://cloudflareinsights.com';

const contentSecurityPolicy = (analytics: boolean): string =>
  [
    "default-src 'self'",
    `script-src 'self'${analytics ? ` ${ANALYTICS_SCRIPT}` : ''}`,
    `connect-src 'self'${analytics ? ` ${ANALYTICS_REPORT}` : ''}`,
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

export interface App {
  readonly server: Server;
  readonly db: Db;
  readonly games: Games;
  close(): Promise<void>;
}

export const createApp = (config: ServerConfig): App => {
  const db = openDatabase(config.databasePath);
  const sessions = new Sessions(db, config.now);
  const users = new Users(db, config.now);
  const hub = new Hub();
  const authLimiter = new RateLimiter(10, 60_000, config.now);
  /** Failed logins per username, whatever the IP, so a botnet cannot brute-force one account. */
  const loginFailures = new RateLimiter(20, 15 * 60_000, config.now);
  /** New sessions per IP: each one is a database row. */
  const sessionLimiter = new RateLimiter(30, 60_000, config.now);
  /** The export reads every game of the account: a few per minute is plenty. */
  const exportLimiter = new RateLimiter(5, 60_000, config.now);
  const csp = contentSecurityPolicy(config.cloudflareWebAnalytics);
  let closing = false;

  const toPlayer = (session: Session): Player => {
    const user = session.userId ? users.findById(session.userId) : undefined;
    return { sessionId: session.id, userId: user?.id ?? null, name: user?.name ?? ANONYMOUS_NAME };
  };

  const publishGame = (room: GameRoom) =>
    hub.publish(`game:${room.id}`, (client) => ({
      t: 'game',
      game: room.view(client.player.sessionId, client.player.userId),
    }));

  const games = new Games(db, users, {
    now: config.now,
    abortAfterMs: config.abortAfterMs,
    claimAfterMs: config.claimAfterMs,
    broadcast: publishGame,
  });

  const lobbyView = (player: Player): LobbyView => ({
    seeks: lobby.seekViews(player),
    playing: games.ongoing().length,
    online: hub.onlineCount(),
  });
  const publishLobby = () => hub.publish('lobby', (client) => ({ t: 'lobby', lobby: lobbyView(client.player) }));

  const lobby: Lobby = new Lobby(games, users, {
    now: config.now,
    random: Math.random,
    onSeeksChange: publishLobby,
    onChallengeChange: (challenge) =>
      hub.publish(`challenge:${challenge.id}`, (client) => ({
        t: 'challenge',
        challenge: lobby.challengeView(challenge, client.player),
      })),
    onGameStart: (room) => {
      for (const seat of Object.values(room.seats)) {
        hub.toSession(seat.sessionId, seat.userId, { t: 'redirect', path: `/${room.id}` });
      }
      publishLobby();
    },
  });

  const updatePresence = (room: GameRoom) => {
    const watchers = hub.subscribers(`game:${room.id}`);
    for (const color of ['white', 'black'] as Color[]) {
      const seat = room.seats[color];
      const online = watchers.some(
        (client) =>
          client.player.sessionId === seat.sessionId || (seat.userId !== null && client.player.userId === seat.userId),
      );
      room.setPresence(color, online);
    }
  };

  const onlineUsers = () => new Set(hub.clients().flatMap((client) => (client.player.userId ? [client.player.userId] : [])));

  const playingByUser = () => {
    const map = new Map<string, string>();
    for (const room of games.ongoing()) {
      for (const seat of Object.values(room.seats)) if (seat.userId) map.set(seat.userId, room.id);
    }
    return map;
  };

  const requireUser = (ctx: Context): string => {
    if (!ctx.session.userId) throw new HttpError(401, 'loginRequired');
    return ctx.session.userId;
  };

  const findUser = (name: string) => {
    const user = users.findByName(name);
    if (!user) throw new HttpError(404, 'userNotFound');
    return user;
  };

  const leaders = (mode: Mode, limit: number, online: Set<string>): LeaderEntry[] =>
    users.leaderboard(mode, limit).map((row) => ({ ...row, online: online.has(row.user.id) }));

  /**
   * Login, signup and logout replace the session id (against session fixation). Anonymous seats, seeks and
   * challenges follow the browser to the new id, and sockets still holding the old identity are closed so they
   * reconnect with the new cookie.
   */
  const rotateSession = (ctx: Context, userId: string | null): void => {
    const previous = ctx.session.id;
    const next = sessions.rotate(previous, userId, ctx.req.headers['user-agent']);
    games.rebindSession(previous, next.id);
    lobby.rebindSession(previous, next.id);
    ctx.setSession(next);
    for (const client of hub.clients()) {
      if (client.player.sessionId === previous) client.socket.close(4001, 'session changed');
    }
  };

  const closeSessionSockets = (ids: readonly string[]): void => {
    const revoked = new Set(ids);
    for (const client of hub.clients()) {
      if (revoked.has(client.player.sessionId)) client.socket.close(4001, 'session changed');
    }
  };

  const closeUserSockets = (userId: string): void => {
    for (const client of hub.clients()) {
      if (client.player.userId === userId) client.socket.close(4001, 'session changed');
    }
  };

  const router = new Router();
  const userPayload = (session: Session) => {
    const player = toPlayer(session);
    return player.userId ? { id: player.userId, name: player.name } : null;
  };

  router
    .add('GET', '/api/me', (ctx) => {
      const me: Me = { user: userPayload(ctx.session), playing: games.playingFor(ctx.session.id, ctx.session.userId) };
      sendJson(ctx.res, 200, me);
    })
    .add('POST', '/api/signup', async (ctx) => {
      if (!authLimiter.allow(ctx.ip)) throw new HttpError(429, 'tooManyAttempts');
      const { username, password } = (await ctx.body()) as { username?: unknown; password?: unknown };
      if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
        throw new HttpError(400, 'invalidUsername');
      }
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        throw new HttpError(400, 'invalidPassword');
      }
      const user = users.create(username, await hashPassword(password));
      if (!user) throw new HttpError(409, 'usernameTaken');
      rotateSession(ctx, user.id);
      sendJson(ctx.res, 200, { user: { id: user.id, name: user.name } });
    })
    .add('POST', '/api/login', async (ctx) => {
      if (!authLimiter.allow(ctx.ip)) throw new HttpError(429, 'tooManyAttempts');
      const { username, password } = (await ctx.body()) as { username?: unknown; password?: unknown };
      const key = typeof username === 'string' ? username.toLowerCase() : '';
      if (loginFailures.blocked(key)) throw new HttpError(429, 'tooManyAttempts');
      const user = typeof username === 'string' ? users.findByName(username) : undefined;
      if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) {
        loginFailures.allow(key);
        throw new HttpError(401, 'wrongCredentials');
      }
      if (needsRehash(user.passwordHash)) users.updatePasswordHash(user.id, await hashPassword(password));
      rotateSession(ctx, user.id);
      sendJson(ctx.res, 200, { user: { id: user.id, name: user.name } });
    })
    .add('POST', '/api/logout', (ctx) => {
      rotateSession(ctx, null);
      sendJson(ctx.res, 200, { user: null });
    })
    .add('POST', '/api/account/password', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError(429, 'tooManyAttempts');
      const { current, next } = (await ctx.body()) as { current?: unknown; next?: unknown };
      const user = users.findById(userId);
      if (!user || typeof current !== 'string' || !(await verifyPassword(current, user.passwordHash))) {
        throw new HttpError(401, 'wrongPassword');
      }
      if (typeof next !== 'string' || next.length < 8 || next.length > 200) throw new HttpError(400, 'invalidPassword');
      users.updatePasswordHash(userId, await hashPassword(next));
      // Every other device must sign in again with the new password.
      sessions.deleteOtherSessions(userId, ctx.session.id);
      closeUserSockets(userId);
      rotateSession(ctx, userId);
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/account/delete', async (ctx) => {
      const userId = requireUser(ctx);
      if (!authLimiter.allow(ctx.ip)) throw new HttpError(429, 'tooManyAttempts');
      const { password } = (await ctx.body()) as { password?: unknown };
      const user = users.findById(userId);
      if (!user || typeof password !== 'string' || !(await verifyPassword(password, user.passwordHash))) {
        throw new HttpError(401, 'wrongPassword');
      }
      if (games.hasOngoing(userId)) throw new HttpError(409, 'activeGame');
      lobby.removeUser(userId);
      games.anonymizeUser(userId, ANONYMOUS_NAME);
      users.delete(userId);
      closeUserSockets(userId);
      rotateSession(ctx, null);
      sendJson(ctx.res, 200, { user: null });
    })
    .add('GET', '/api/account/sessions', (ctx) => {
      const userId = requireUser(ctx);
      const list: SessionView[] = sessions.listForUser(userId).map((session) => ({
        id: sessionHandle(session.id),
        current: session.id === ctx.session.id,
        createdAt: session.createdAt,
        seenAt: session.seenAt,
        userAgent: session.userAgent,
      }));
      sendJson(ctx.res, 200, list);
    })
    .add('DELETE', '/api/account/sessions', (ctx) => {
      const userId = requireUser(ctx);
      const removed = sessions.deleteOtherSessions(userId, ctx.session.id);
      closeSessionSockets(removed);
      sendJson(ctx.res, 200, { revoked: removed.length });
    })
    .add('DELETE', '/api/account/sessions/:id', (ctx) => {
      const userId = requireUser(ctx);
      const removed = sessions.deleteByHandle(userId, ctx.params.id!, ctx.session.id);
      if (!removed) throw new HttpError(404, 'sessionNotFound');
      closeSessionSockets([removed]);
      sendJson(ctx.res, 200, { revoked: 1 });
    })
    .add('GET', '/api/account/export', (ctx) => {
      const userId = requireUser(ctx);
      if (!exportLimiter.allow(userId)) throw new HttpError(429, 'tooManyAttempts');
      const user = users.findById(userId);
      if (!user) throw new HttpError(401, 'loginRequired');
      const iso = (ms: number) => new Date(ms).toISOString();
      const data = {
        about: 'Personal data held by ligungi for this account (LGPD access right). Preferences live only in your browser.',
        exportedAt: iso(config.now()),
        account: { id: user.id, username: user.name, createdAt: iso(user.createdAt) },
        ratings: users.ratings(userId),
        following: users.following(userId).map((entry) => entry.name),
        followers: users.followers(userId).map((entry) => entry.name),
        sessions: sessions.listForUser(userId).map((session) => ({
          current: session.id === ctx.session.id,
          createdAt: iso(session.createdAt),
          lastActive: iso(session.seenAt),
          browser: session.userAgent,
        })),
        games: games.exportFor(userId),
      };
      ctx.res.setHeader('content-disposition', `attachment; filename="ligungi-${user.name}.json"`);
      ctx.res.setHeader('cache-control', 'no-store');
      sendJson(ctx.res, 200, data);
    })
    .add('GET', '/api/users', (ctx) => {
      const query = ctx.url.searchParams.get('q')?.trim() ?? '';
      if (!/^[A-Za-z0-9_-]{2,20}$/.test(query)) return sendJson(ctx.res, 200, []);
      const online = onlineUsers();
      const results: UserSearchResult[] = users
        .search(query, SEARCH_LIMIT)
        .map((user) => ({ user, online: online.has(user.id) }));
      sendJson(ctx.res, 200, results);
    })
    .add('GET', '/api/health', (ctx) => {
      try {
        db.prepare('select 1').get();
        sendJson(ctx.res, 200, { ok: true, ...BUILD });
      } catch {
        sendJson(ctx.res, 503, { ok: false, ...BUILD });
      }
    })
    .add('GET', '/api/users/:name', (ctx) => {
      const user = findUser(ctx.params.name!);
      const profile: UserProfile = {
        user: { id: user.id, name: user.name },
        createdAt: user.createdAt,
        online: onlineUsers().has(user.id),
        ratings: users.ratings(user.id),
        ranks: Object.fromEntries(MODES.map((mode) => [mode, users.rank(user.id, mode)])) as Record<Mode, number | null>,
        counts: games.counts(user.id),
        ...users.followCounts(user.id),
        followed: ctx.session.userId ? users.isFollowing(ctx.session.userId, user.id) : false,
        playing: games.ongoing().filter((room) => room.colorOf('', user.id)).map((room) => room.summary()),
        recent: games.recentFor(user.id, 20),
      };
      sendJson(ctx.res, 200, profile);
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
    .add('POST', '/api/users/:name/follow', (ctx) => {
      const userId = requireUser(ctx);
      const target = findUser(ctx.params.name!);
      if (target.id === userId) throw new HttpError(400, 'cannotFollowSelf');
      if (!users.isFollowing(userId, target.id) && users.followCounts(userId).following >= MAX_FOLLOWS) {
        throw new HttpError(400, 'tooManyFollows');
      }
      users.follow(userId, target.id);
      sendJson(ctx.res, 200, { followed: true, ...users.followCounts(target.id) });
    })
    .add('DELETE', '/api/users/:name/follow', (ctx) => {
      const userId = requireUser(ctx);
      const target = findUser(ctx.params.name!);
      users.unfollow(userId, target.id);
      sendJson(ctx.res, 200, { followed: false, ...users.followCounts(target.id) });
    })
    .add('GET', '/api/following', (ctx) => {
      const userId = requireUser(ctx);
      const online = onlineUsers();
      const playing = playingByUser();
      const list: FriendView[] = users.following(userId).map((user) => ({
        user,
        online: online.has(user.id),
        playing: playing.get(user.id) ?? null,
        ratings: users.ratings(user.id),
      }));
      sendJson(ctx.res, 200, list);
    })
    .add('GET', '/api/leaderboard', (ctx) => {
      const online = onlineUsers();
      const board = Object.fromEntries(MODES.map((mode) => [mode, leaders(mode, LEADERBOARD_TOP, online)])) as unknown as Leaderboard;
      sendJson(ctx.res, 200, board);
    })
    .add('GET', '/api/leaderboard/:mode', (ctx) => {
      const mode = ctx.params.mode as Mode;
      if (!MODES.includes(mode)) throw new HttpError(404, 'invalidMode');
      const limit = Math.min(LEADERBOARD_MAX, Math.max(1, Math.trunc(Number(ctx.url.searchParams.get('limit'))) || LEADERBOARD_MAX));
      sendJson(ctx.res, 200, leaders(mode, limit, onlineUsers()));
    })
    .add('GET', '/api/games/:id', (ctx) => {
      const room = games.get(ctx.params.id!);
      if (!room) throw new HttpError(404, 'gameNotFound');
      sendJson(ctx.res, 200, room.view(ctx.session.id, ctx.session.userId));
    })
    .add('GET', '/api/games/:id/export', (ctx) => {
      const room = games.get(ctx.params.id!);
      if (!room) throw new HttpError(404, 'gameNotFound');
      const origin = `${ctx.req.headers['x-forwarded-proto'] ?? 'http'}://${ctx.req.headers.host ?? SITE_NAME}`;
      sendText(ctx.res, 200, exportGame(room, origin));
    })
    .add('GET', '/api/tv', (ctx) => {
      const rating = (room: GameRoom) => (room.seats.white.rating ?? 1200) + (room.seats.black.rating ?? 1200);
      const list = games
        .ongoing()
        .filter((room) => room.plies > 0)
        .sort((a, b) => rating(b) - rating(a) || b.createdAt - a.createdAt)
        .slice(0, 24)
        .map((room) => room.summary());
      sendJson(ctx.res, 200, list);
    })
    .add('GET', '/api/version', (ctx) => sendJson(ctx.res, 200, BUILD))
    .add('GET', '/api/lobby', (ctx) => sendJson(ctx.res, 200, lobbyView(ctx.player)))
    .add('POST', '/api/seeks', async (ctx) => {
      const settings = parseSettings(await ctx.body());
      if (isErrorCode(settings)) throw new HttpError(400, settings);
      const result = lobby.createSeek(ctx.player, settings, hub.hasSession(ctx.session.id));
      if (isErrorCode(result)) throw new HttpError(result === 'connectionRequired' ? 409 : 400, result);
      sendJson(ctx.res, 200, result);
    })
    .add('POST', '/api/seeks/:id/accept', (ctx) => {
      const result = lobby.acceptSeek(ctx.params.id!, ctx.player);
      if (isErrorCode(result)) throw new HttpError(409, result);
      sendJson(ctx.res, 200, result);
    })
    .add('DELETE', '/api/seeks/:id', (ctx) => {
      if (!lobby.cancelSeek(ctx.params.id!, ctx.player)) throw new HttpError(404, 'seekNotFound');
      sendJson(ctx.res, 200, { ok: true });
    })
    .add('POST', '/api/challenges', async (ctx) => {
      const settings = parseSettings(await ctx.body());
      if (isErrorCode(settings)) throw new HttpError(400, settings);
      const challenge = lobby.createChallenge(ctx.player, settings);
      if (isErrorCode(challenge)) throw new HttpError(400, challenge);
      sendJson(ctx.res, 200, lobby.challengeView(challenge, ctx.player));
    })
    .add('GET', '/api/challenges/:id', (ctx) => {
      const challenge = lobby.challenge(ctx.params.id!);
      if (!challenge) throw new HttpError(404, 'challengeNotFound');
      sendJson(ctx.res, 200, lobby.challengeView(challenge, ctx.player));
    })
    .add('POST', '/api/challenges/:id/accept', (ctx) => {
      const result = lobby.acceptChallenge(ctx.params.id!, ctx.player);
      if (isErrorCode(result)) throw new HttpError(409, result);
      sendJson(ctx.res, 200, result);
    })
    .add('DELETE', '/api/challenges/:id', (ctx) => {
      if (!lobby.cancelChallenge(ctx.params.id!, ctx.player)) throw new HttpError(404, 'challengeNotFound');
      sendJson(ctx.res, 200, { ok: true });
    });

  const sameOrigin = (req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      const host = new URL(origin).host;
      const forwarded = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
      return host === req.headers.host || host === forwarded;
    } catch {
      return false;
    }
  };

  /**
   * Sessions are only stored when they matter: writes and `/api/me`, which the site calls on load before opening
   * the WebSocket. Other reads get a throwaway session, so crawlers and scripts do not fill the database.
   */
  const resolveSession = (req: IncomingMessage, res: ServerResponse, url: URL, ip: string): Session => {
    const existing = sessions.get(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    if (existing) return existing;
    if (req.method === 'GET' && url.pathname !== '/api/me') return { id: `ephemeral:${randomId(24)}`, userId: null };
    if (!sessionLimiter.allow(ip)) throw new HttpError(429, 'tooManyAttempts');
    const created = sessions.create();
    res.setHeader('set-cookie', sessionCookie(created.id, config.secureCookies));
    return created;
  };

  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    if (!url.pathname.startsWith('/api/')) {
      res.setHeader('content-security-policy', csp);
      if ((req.method === 'GET' || req.method === 'HEAD') && config.staticDir && serveStatic(config.staticDir, url, req.headers['accept-language'], res, req.method === 'HEAD')) return;
      sendText(res, 404, 'Not found');
      return;
    }
    const matched = router.match(req.method ?? 'GET', url.pathname);
    if (!matched) return sendError(res, 404, 'routeNotFound');
    if (req.method !== 'GET') {
      const json = req.headers['content-type']?.startsWith('application/json');
      if (!sameOrigin(req) || (!json && req.method !== 'DELETE')) {
        return sendError(res, 403, 'forbidden');
      }
    }
    const ip = clientIp(req, config.trustProxy);
    const session = resolveSession(req, res, url, ip);
    const ctx: Context = {
      req,
      res,
      url,
      params: matched.params,
      session,
      player: toPlayer(session),
      ip,
      body: () => readJson(req),
      setSession: (next) => res.setHeader('set-cookie', sessionCookie(next.id, config.secureCookies)),
    };
    await matched.handler(ctx);
  };

  /** Every failure ends in a response: one bad request must never take the process down. */
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) {
        if (!res.headersSent) sendError(res, error.status, error.code);
        return;
      }
      console.error(error);
      if (!res.headersSent) sendError(res, 500, 'internal');
      else res.destroy();
    });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const session = sessions.get(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
      if (url.pathname !== '/ws' || !session || !sameOrigin(req)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, toPlayer(session)));
    } catch (error) {
      console.error(error);
      socket.destroy();
    }
  });

  const validTopic = (topic: unknown): topic is Topic =>
    typeof topic === 'string' && (topic === 'lobby' || /^(game|challenge):[A-Za-z0-9]{1,16}$/.test(topic));

  const onConnection = (socket: WebSocket, player: Player) => {
    const client: Client = { socket, player, topics: new Set(), alive: true };
    hub.add(client);
    socket.on('pong', () => (client.alive = true));
    socket.on('message', (data) => {
      const message = parseClientMessage(data.toString());
      if (message) handleMessage(client, message);
    });
    socket.on('close', () => {
      if (closing) return;
      const topics = hub.remove(client);
      for (const topic of topics) {
        if (topic.startsWith('game:')) {
          const room = games.get(topic.slice(5));
          if (room) updatePresence(room);
        }
      }
      if (!hub.hasSession(player.sessionId)) lobby.removeSeeksOf(player.sessionId);
      publishLobby();
    });
    publishLobby();
  };

  const handleMessage = (client: Client, message: ClientMessage) => {
    const error = (code: ErrorCode) => hub.send(client, { t: 'error', code, message: ERROR_MESSAGES[code] });
    switch (message.t) {
      case 'ping':
        hub.send(client, { t: 'pong' });
        return;
      case 'sub': {
        const topic = message.topic;
        if (!validTopic(topic)) return error('invalidTopic');
        if (!client.topics.has(topic) && client.topics.size >= MAX_TOPICS_PER_CLIENT) return error('tooManySubscriptions');
        const [kind, id] = topic.split(':') as [string, string | undefined];
        if (kind === 'lobby') {
          hub.subscribe(client, topic);
          hub.send(client, { t: 'lobby', lobby: lobbyView(client.player) });
        } else if (kind === 'game' && id) {
          const room = games.get(id);
          if (!room) return error('gameNotFound');
          hub.subscribe(client, topic);
          updatePresence(room);
          hub.send(client, { t: 'game', game: room.view(client.player.sessionId, client.player.userId) });
        } else if (kind === 'challenge' && id) {
          const challenge = lobby.challenge(id);
          if (!challenge) return error('challengeNotFound');
          hub.subscribe(client, topic);
          hub.send(client, { t: 'challenge', challenge: lobby.challengeView(challenge, client.player) });
        }
        return;
      }
      case 'unsub': {
        if (!validTopic(message.topic)) return;
        hub.unsubscribe(client, message.topic);
        if (message.topic.startsWith('game:')) {
          const room = games.get(message.topic.slice(5));
          if (room) updatePresence(room);
        }
        return;
      }
      default: {
        if (typeof message.game !== 'string') return error('invalidGame');
        const room = games.get(message.game);
        if (!room) return error('gameNotFound');
        const color = room.colorOf(client.player.sessionId, client.player.userId);
        if (!color) return error('notAPlayer');
        let result: ErrorCode | null;
        if (message.t === 'move') {
          result = typeof message.move === 'string' && Number.isInteger(message.ply)
            ? room.move(color, message.move, message.ply)
            : 'invalidMove';
        } else if (message.t === 'resign') result = room.resign(color);
        else if (message.t === 'abort') result = room.abort(color);
        else if (message.t === 'claim') result = room.claim(color);
        else if (message.t === 'draw' || message.t === 'rematch') {
          const action = message.action;
          if (action !== 'offer' && action !== 'accept' && action !== 'decline') result = 'invalidAction';
          else result = message.t === 'draw' ? room.draw(color, action) : room.rematch(color, action);
        } else result = 'unknownMessage';
        if (result) {
          error(result);
          hub.send(client, { t: 'game', game: room.view(client.player.sessionId, client.player.userId) });
        } else if (message.t === 'rematch' && room.rematchId) {
          const next = games.get(room.rematchId);
          if (next) for (const seat of Object.values(next.seats)) {
            hub.toSession(seat.sessionId, seat.userId, { t: 'redirect', path: `/${next.id}` });
          }
        }
      }
    }
  };

  const heartbeat = setInterval(() => {
    for (const client of hub.clients()) {
      if (!client.alive) {
        client.socket.terminate();
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  sessions.sweep();
  const sessionSweep = setInterval(() => sessions.sweep(), SESSION_SWEEP_MS);
  sessionSweep.unref();

  return {
    server,
    db,
    games,
    close: () =>
      new Promise<void>((resolve) => {
        closing = true;
        clearInterval(heartbeat);
        clearInterval(sessionSweep);
        for (const client of hub.clients()) client.socket.terminate();
        wss.close();
        server.close(() => {
          games.close();
          db.close();
          resolve();
        });
        server.closeAllConnections();
      }),
  };
};

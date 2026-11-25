import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { MODES, type Color, type Mode } from '@ligungi/engine';
import {
  ERROR_MESSAGES,
  SHORT_LINKS,
  RECENT_GAMES,
  RECENT_PLAYERS,
  RATING_TREND_DAYS,
  DAY_MS,
  parseClientMessage,
  type LeaderEntry,
  type ErrorCode,
  type ClientMessage,
  type LobbyView,
  type Topic,
  type NoticeKind,
  type NoticeView,
  ONLINE_LIST_MAX,
  RANKING_PAGE_SIZE,
  RANKING_QUERY_MAX,
  RATING_BAND,
  REPORT_DETAILS_MAX,
  type ReportReason,
  type ModeStanding,
  type OnlinePlayer,
  type PlayersView,
  type RankingView,
  STUDY_CHAPTER_NAME_MAX,
  STUDY_DESCRIPTION_MAX,
  STUDY_PUBLIC_MIN_DAYS,
  STUDY_TITLE_MAX,
  emptyRoot,
  isOrientation,
  isStudyVisibility,
  parseStudyRoot,
  studyStart,
  studyText,
  type StudyRoot,
} from '@ligungi/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  SESSION_COOKIE,
  Sessions,
  parseCookies,
  sessionCookie,
  type Session,
} from './auth.ts';
import { ActivityHalls } from './discordActivity.ts';
import { Racers } from './racer.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerAccountRoutes } from './routes/account.ts';
import { registerDiscordActivityRoutes } from './routes/discordActivity.ts';
import { registerDiscordRoutes } from './routes/discord.ts';
import { registerModerationRoutes } from './routes/moderation.ts';
import { registerStudiesRoutes } from './routes/studies.ts';
import { registerCommunityRoutes } from './routes/community.ts';
import { registerPlayRoutes } from './routes/play.ts';
import { registerTrainingRoutes } from './routes/training.ts';
import { ChallengeStore } from './challenges.ts';
import type { ServerConfig } from './config.ts';
import { openDatabase, type Db } from './db.ts';
import { DiscordLinks } from './discord.ts';
import { DraftExplorer } from './explorer.ts';
import { Games, type Player } from './games.ts';
import { randomId } from './ids.ts';
import {
  HttpError,
  DISCORD_PROXY,
  RateLimiter,
  Router,
  clientIp,
  readJson,
  sendError,
  sendText,
  serveStatic,
  type Context,
} from './http.ts';
import { Hub, type Client } from './hub.ts';
import { Lobby } from './lobby.ts';
import { Moderation } from './moderation.ts';
import { Notices, type NoticeDetails } from './notices.ts';
import { PuzzleStore } from './puzzles.ts';
import type { GameRoom } from './room.ts';
import { SeekStore } from './seeks.ts';
import { Studies, type ChapterInput, type StudyRecord } from './studies.ts';
import { Tv } from './tv.ts';
import { TwoFactor } from './two-factor.ts';
import { ANONYMOUS_NAME, Users } from './users.ts';

const HEARTBEAT_MS = 30_000;
const SESSION_SWEEP_MS = 6 * 3_600_000;
/** The site-wide counts and rating distribution on the players page are recomputed at most this often. */
const PLAYERS_CACHE_MS = 60_000;
/** Expired challenges are canceled within this delay even if nobody opens them (the receiver's list updates). */
const CHALLENGE_SWEEP_MS = 60_000;
const MAX_TOPICS_PER_CLIENT = 32;
/** Live games listed for the TV and the home page. */
const TV_GAMES = 24;
const TV_PUBLISH_MS = 500;
/** Cloudflare Web Analytics: no cookies, aggregate only; its edge injects this script into the HTML. */
const ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';
const ANALYTICS_REPORT = 'https://cloudflareinsights.com';

/** Where Discord shows an Activity: its clients (web, desktop, mobile) and the Activity frames themselves. */
const DISCORD_FRAMES = 'https://discord.com https://*.discord.com https://discordapp.com https://*.discordapp.com https://*.discordsays.com';

const contentSecurityPolicy = (analytics: boolean, embedded = false): string =>
  [
    "default-src 'self'",
    `script-src 'self'${analytics ? ` ${ANALYTICS_SCRIPT}` : ''}`,
    `connect-src 'self'${analytics ? ` ${ANALYTICS_REPORT}` : ''}`,
    // Inside Discord the call's people show with their Discord avatars.
    `img-src 'self' data:${embedded ? ' https://cdn.discordapp.com' : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    embedded ? `frame-ancestors ${DISCORD_FRAMES}` : "frame-ancestors 'none'",
  ].join('; ');

export interface App {
  readonly server: Server;
  readonly db: Db;
  readonly games: Games;
  readonly discord: DiscordLinks;
  close(): Promise<void>;
}

/**
 * Everything the routes, the WebSocket and the timers share: the stores, the live game state, the rate limits and the
 * helpers that act across them. Built once per server.
 */
const createDeps = (config: ServerConfig) => {
  const db = openDatabase(config.databasePath);
  const sessions = new Sessions(db, config.now);
  const twoFactor = new TwoFactor(db, config.now);
  const moderation = new Moderation(db, config.now);
  const users = new Users(db, config.now);
  const notices = new Notices(db, config.now);
  const hub = new Hub();
  const authLimiter = new RateLimiter(10, 60_000, config.now, { [DISCORD_PROXY]: 120 });
  /** Failed logins per username, whatever the IP, so a botnet cannot brute-force one account. */
  const loginFailures = new RateLimiter(20, 15 * 60_000, config.now);
  /** New sessions per IP: each one is a database row. */
  const sessionLimiter = new RateLimiter(30, 60_000, config.now, { [DISCORD_PROXY]: 600 });
  /** The export reads every game of the account: a few per minute is plenty. */
  const exportLimiter = new RateLimiter(5, 60_000, config.now);
  /** Reports a player can file per hour: enough for real cases, too few to flood the queue. */
  const reportLimiter = new RateLimiter(10, 60 * 60_000, config.now);
  const csp = contentSecurityPolicy(config.cloudflareWebAnalytics);
  const activityCsp = contentSecurityPolicy(config.cloudflareWebAnalytics, true);

  const toPlayer = (session: Session): Player => {
    const user = session.userId ? users.findById(session.userId) : undefined;
    return { sessionId: session.id, userId: user?.id ?? null, name: user?.name ?? ANONYMOUS_NAME };
  };

  /** Sends a user, on every device, the correspondence games waiting for their move. */
  const sendTurns = (userId: string): void => {
    const waiting = games
      .ongoing()
      .filter((room) => room.daysPerMove !== null && room.seats[room.game.position.turn].userId === userId)
      .map((room) => room.summary());
    for (const client of hub.clients()) if (client.player.userId === userId) hub.send(client, { t: 'turns', games: waiting });
  };

  const sendNotices = (userId: string): void => {
    let list: NoticeView[] | null = null;
    for (const client of hub.clients()) {
      if (client.player.userId !== userId) continue;
      list ??= notices.list(userId);
      hub.send(client, { t: 'notices', notices: list });
    }
  };

  /** Records a notice for the bell and shows it at once wherever the player is connected. */
  const notice = (userId: string, kind: NoticeKind, details?: NoticeDetails): void => {
    if (notices.add(userId, kind, details)) sendNotices(userId);
  };

  const publishGame = (room: GameRoom) => {
    hub.publish(`game:${room.id}`, (client) => ({
      t: 'game',
      game: room.view(client.player.sessionId, client.player.userId),
    }));
    // The other player may be anywhere on the site, waiting for this move.
    if (room.daysPerMove !== null) {
      for (const seat of Object.values(room.seats)) if (seat.userId) sendTurns(seat.userId);
    } else publishTv();
  };

  const discord = new DiscordLinks(db, users, config.discord, config.fetch, config.now);
  /** Discord sign-ins and checks per player and minute: each one calls Discord. */
  const discordLimiter = new RateLimiter(10, 60_000, config.now);

  const games = new Games(db, users, {
    now: config.now,
    abortAfterMs: config.abortAfterMs,
    claimAfterMs: config.claimAfterMs,
    broadcast: publishGame,
    ratingsChanged: (userIds) => discord.ratingsChanged(userIds),
  });

  const tv = new Tv(games, config.now);
  const puzzles = new PuzzleStore(db, config.now);
  const racers: Racers = new Racers(db, {
    now: config.now,
    random: Math.random,
    sequence: () => puzzles.sequence('racer'),
    onChange: (raceId) =>
      hub.publish(`race:${raceId}`, (client) => {
        const race = racers.view(raceId, client.player);
        return race ? { t: 'race', race } : { t: 'error', code: 'raceNotFound', message: ERROR_MESSAGES.raceNotFound };
      }),
  });
  const explorer = new DraftExplorer(db, config.now);
  const studies = new Studies(db, config.now);
  /** Study writes per author and minute: the editor saves on its own after each change, so this is generous. */
  const studyLimiter = new RateLimiter(120, 60_000, config.now);
  /** Game searches and insights per session and minute: each one may read a large part of the games table. */
  const searchLimiter = new RateLimiter(30, 60_000, config.now);
  const tvGames = () => tv.live().slice(0, TV_GAMES).map((room) => room.summary());
  // Every move of every live game changes the list, so changes are gathered and sent at most every TV_PUBLISH_MS.
  let tvTimer: ReturnType<typeof setTimeout> | null = null;
  const publishTv = () => {
    if (tvTimer || hub.subscribers('tv').length === 0) return;
    tvTimer = setTimeout(() => {
      tvTimer = null;
      const list = tvGames();
      hub.publish('tv', () => ({ t: 'tv', games: list }));
    }, TV_PUBLISH_MS);
    tvTimer.unref();
  };

  const lobbyView = (player: Player): LobbyView => ({
    seeks: lobby.seekViews(player),
    playing: games.live().length,
    online: onlineCount(player.sessionId),
  });
  const publishLobby = () => hub.publish('lobby', (client) => ({ t: 'lobby', lobby: lobbyView(client.player) }));

  const challengeStore = new ChallengeStore(db);
  const seekStore = new SeekStore(db);
  const lobby: Lobby = new Lobby(games, users, {
    now: config.now,
    random: Math.random,
    challengeStore,
    seekStore,
    onSeeksChange: publishLobby,
    onChallengeChange: (challenge) => {
      hub.publish(`challenge:${challenge.id}`, (client) => ({
        t: 'challenge',
        challenge: lobby.challengeView(challenge, client.player),
      }));
      if (challenge.destination) sendIncoming(challenge.destination.id);
    },
    onGameStart: (room) => {
      for (const seat of Object.values(room.seats)) {
        hub.toSession(seat.sessionId, seat.userId, { t: 'redirect', path: `/${room.id}` });
        if (room.daysPerMove !== null && seat.userId) sendTurns(seat.userId);
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

  /**
   * Signed-in players with a socket open. Whoever is asking counts too: a page loaded with F5 asks before its socket
   * connects, and would otherwise show its own player offline.
   */
  const onlineUsers = (viewerId: string | null) => {
    const online = new Set(hub.clients().flatMap((client) => (client.player.userId ? [client.player.userId] : [])));
    if (viewerId) online.add(viewerId);
    return online;
  };
  /** Connected browsers, counting the one asking even before its socket opens. */
  const onlineCount = (sessionId: string) => hub.onlineCount() + (hub.hasSession(sessionId) ? 0 : 1);

  const playingByUser = () => {
    const map = new Map<string, string>();
    for (const room of games.live()) {
      for (const seat of Object.values(room.seats)) if (seat.userId) map.set(seat.userId, room.id);
    }
    return map;
  };

  const requireUser = (ctx: Context): string => {
    if (!ctx.session.userId) throw new HttpError(401, 'loginRequired');
    return ctx.session.userId;
  };

  /**
   * A code typed on the account page by a user with two-factor on. Wrong codes count with the failed logins of the
   * account, so an open session does not give more guesses than the sign-in form.
   */
  const checkAccountCode = (userId: string, code: unknown): void => {
    const key = users.findById(userId)?.name.toLowerCase() ?? userId;
    if (loginFailures.blocked(key)) throw new HttpError(429, 'tooManyAttempts');
    if (typeof code !== 'string' || !twoFactor.verify(userId, code)) {
      loginFailures.allow(key);
      throw new HttpError(401, 'wrongTwoFactorCode');
    }
  };

  /** The signed-in moderator, with their name for the log. */
  const requireModerator = (ctx: Context): { id: string; name: string } => {
    const userId = requireUser(ctx);
    const user = users.findById(userId);
    if (!user || !moderation.isModerator(userId)) throw new HttpError(403, 'notModerator');
    return { id: user.id, name: user.name };
  };

  /** A moderator's reason or note: required, at most as long as a report. */
  /** Report reasons as the moderators read them on Discord. */
  const REPORT_LABELS: Readonly<Record<ReportReason, string>> = {
    cheating: 'Cheating',
    name: 'Offensive name or profile',
    behavior: 'Behavior',
    content: 'Offensive content',
    other: 'Other',
  };
  /** A player's text in a Discord message: shown as typed, never as formatting. */
  const discordText = (text: string): string => text.replace(/[\\`*_~|>#\[\]()-]/g, '\\$&');

  const reasonOf = (value: unknown): string => {
    const reason = typeof value === 'string' ? value.trim() : '';
    if (!reason || reason.length > REPORT_DETAILS_MAX) throw new HttpError(400, 'reasonRequired');
    return reason;
  };

  /** A player a moderator acts on; moderators are out of reach (only the server command changes them). */
  const sanctionable = (name: string) => {
    const user = findUser(name);
    if (moderation.isModerator(user.id)) throw new HttpError(403, 'cannotModerateModerator');
    return user;
  };

  /** A study the viewer may open; one they may not is reported as missing, so its existence does not leak. */
  const readableStudy = (ctx: Context): StudyRecord => {
    const study = studies.get(ctx.params.id!);
    if (!study || !studies.canRead(study, ctx.session.userId, moderation.isModerator(ctx.session.userId))) throw new HttpError(404, 'studyNotFound');
    return study;
  };

  /** A study the signed-in user wrote and is about to change. */
  const ownStudy = (ctx: Context): StudyRecord => {
    const userId = requireUser(ctx);
    if (!studyLimiter.allow(userId)) throw new HttpError(429, 'tooManyAttempts');
    const study = readableStudy(ctx);
    if (study.ownerId !== userId) throw new HttpError(403, 'notStudyOwner');
    return study;
  };

  /** Title, description and visibility of a study; new accounts may not make one public yet. */
  const studyFields = (body: Record<string, unknown>, userId: string) => {
    const title = studyText(body.title, STUDY_TITLE_MAX, true);
    const description = studyText(body.description ?? '', STUDY_DESCRIPTION_MAX, false);
    const { visibility } = body;
    if (title === null || description === null || !isStudyVisibility(visibility)) throw new HttpError(400, 'invalidStudy');
    const user = users.findById(userId);
    if (visibility === 'public' && (!user || config.now() - user.createdAt < STUDY_PUBLIC_MIN_DAYS * DAY_MS)) {
      throw new HttpError(403, 'studyPublicTooSoon');
    }
    return { title, description, visibility };
  };

  const checkedRoot = (start: Parameters<typeof parseStudyRoot>[0], value: unknown): StudyRoot => {
    const root = value === undefined ? emptyRoot() : parseStudyRoot(start, value);
    if (root === 'tooLarge') throw new HttpError(400, 'chapterTooLarge');
    if (!root) throw new HttpError(400, 'invalidChapter');
    return root;
  };

  const chapterInput = (value: unknown): ChapterInput => {
    if (typeof value !== 'object' || value === null) throw new HttpError(400, 'invalidChapter');
    const { name, fen, orientation, root } = value as Record<string, unknown>;
    const text = studyText(name, STUDY_CHAPTER_NAME_MAX, true);
    const start = studyStart(fen);
    if (text === null || !start || !isOrientation(orientation)) throw new HttpError(400, 'invalidChapter');
    return { name: text, fen: fen as string, orientation, root: checkedRoot(start, root) };
  };

  /** A finished game between two players where one blocked the other: no rematch between them. */
  const seatsBlocked = (room: { readonly seats: Readonly<Record<'white' | 'black', { readonly userId: string | null }>> }): boolean => {
    const { white, black } = room.seats;
    return white.userId !== null && black.userId !== null && users.isBlocked(white.userId, black.userId);
  };

  const findUser = (name: string) => {
    const user = users.findByName(name);
    if (!user) throw new HttpError(404, 'userNotFound');
    return user;
  };

  let playersCache: {
    at: number;
    stats: Pick<PlayersView['counts'], 'gamesLastDay' | 'gamesTotal' | 'players'>;
    distribution: PlayersView['distribution'];
    ranks: Record<Mode, Map<string, number>>;
    recent: PlayersView['recent'];
  } | null = null;

  const RANKING_PAGE_LIMIT = 100_000;

  const rankingView = (requested: Mode | null, params: URLSearchParams, viewerId: string | null): RankingView => {
    const counts = users.rankedCounts();
    const standings = viewerId ? users.ratings(viewerId) : null;
    const modes = Object.fromEntries(
      MODES.map((m) => {
        const own = standings?.[m];
        const you: ModeStanding | null =
          viewerId && own && own.games > 0
            ? { rating: own.rating, provisional: own.provisional, games: own.games, rank: users.rank(viewerId, m) }
            : null;
        return [m, { players: counts[m], you }];
      }),
    ) as RankingView['modes'];
    // Without a mode: the viewer's most played one, otherwise the one with the most ranked players (the hardest on a tie).
    const fallback = [...MODES].reverse().reduce((best, m) => (counts[m] > counts[best] ? m : best), 'advanced' as Mode);
    const mine = MODES.filter((m) => modes[m].you).sort((a, b) => modes[b].you!.games - modes[a].you!.games)[0];
    const mode = requested ?? mine ?? fallback;
    // Capped so the offset stays an integer SQLite accepts; pages past the end simply come back empty.
    const page = Math.min(RANKING_PAGE_LIMIT, Math.max(1, Math.trunc(Number(params.get('page'))) || 1));
    const query = (params.get('q') ?? '').trim().slice(0, RANKING_QUERY_MAX);
    const followerId = viewerId && params.get('followed') === '1' ? viewerId : null;
    const { rows, total } = users.rankingPage(mode, { query, followerId }, (page - 1) * RANKING_PAGE_SIZE, RANKING_PAGE_SIZE);
    const records = games.recordsIn(mode, rows.map((row) => row.user.id));
    const trends = games.ratingTrends(mode, rows.map((row) => row.user.id), trendSince());
    const online = onlineUsers(viewerId);
    const followed = new Set(viewerId ? users.following(viewerId).map((user) => user.id) : []);
    const place = viewerId ? users.rankingPlace(viewerId, mode) : null;
    return {
      mode,
      rows: rows.map((row) => ({
        ...row,
        record: records.get(row.user.id) ?? { wins: 0, draws: 0, losses: 0 },
        online: online.has(row.user.id),
        followed: followed.has(row.user.id),
        trend: trends.get(row.user.id) ?? 0,
      })),
      total,
      page,
      pageSize: RANKING_PAGE_SIZE,
      modes,
      you: place ? { rank: place.rank, page: Math.ceil(place.row / RANKING_PAGE_SIZE) } : null,
    };
  };

  const playersView = (viewerId: string | null, sessionId: string): PlayersView => {
    const now = config.now();
    if (!playersCache || now - playersCache.at >= PLAYERS_CACHE_MS) {
      const { recent, finished } = games.activity(now - 24 * 3_600_000);
      const bands = (mode: Mode) => users.ratingDistribution(mode, RATING_BAND);
      playersCache = {
        at: now,
        stats: { gamesLastDay: recent, gamesTotal: finished, players: users.count() },
        distribution: { intro: bands('intro'), beginner: bands('beginner'), intermediate: bands('intermediate'), advanced: bands('advanced') },
        ranks: { intro: users.ranks('intro'), beginner: users.ranks('beginner'), intermediate: users.ranks('intermediate'), advanced: users.ranks('advanced') },
        recent: { games: games.recentlyFinished(RECENT_GAMES), players: users.newest(RECENT_PLAYERS) },
      };
    }
    const cache = playersCache;
    const ongoing = games.live();
    const playingIn = new Map<string, string>();
    for (const room of ongoing) for (const seat of Object.values(room.seats)) if (seat.userId) playingIn.set(seat.userId, room.id);
    const signedIn = [...onlineUsers(viewerId)];
    const ids = signedIn.slice(0, 500);
    const ratings = users.playedRatings(viewerId ? [...ids, viewerId] : ids);
    const followed = new Set(viewerId ? users.following(viewerId).map((user) => user.id) : []);
    const best = (player: OnlinePlayer) => Math.max(0, ...Object.values(player.ratings).map((standing) => standing.rating));
    const online: OnlinePlayer[] = ids
      .map((id) => users.findById(id))
      .filter((user) => user !== undefined)
      .map((user) => ({
        user: { id: user.id, name: user.name },
        country: user.country,
        ratings: Object.fromEntries(
          (ratings.get(user.id) ?? []).map((entry) => [
            entry.mode,
            { rating: entry.rating, provisional: entry.provisional, games: entry.games, rank: cache.ranks[entry.mode].get(user.id) ?? null },
          ]),
        ),
        playing: playingIn.get(user.id) ?? null,
        followed: followed.has(user.id),
        canChallenge: viewerId !== null && users.canChallenge(viewerId, user.id),
      }))
      .sort((a, b) => Number(a.playing !== null) - Number(b.playing !== null) || best(b) - best(a) || a.user.name.localeCompare(b.user.name))
      .slice(0, ONLINE_LIST_MAX);
    const you = viewerId ? Object.fromEntries((ratings.get(viewerId) ?? []).map((entry) => [entry.mode, entry.rating])) : null;
    return {
      online,
      counts: {
        online: onlineCount(sessionId),
        signedIn: signedIn.length,
        free: signedIn.filter((id) => !playingIn.has(id)).length,
        playing: ongoing.length,
        ...cache.stats,
      },
      distribution: cache.distribution,
      you,
      recent: cache.recent,
    };
  };

  const trendSince = () => config.now() - RATING_TREND_DAYS * DAY_MS;
  const leaders = (mode: Mode, limit: number, online: Set<string>): LeaderEntry[] => {
    const rows = users.leaderboard(mode, limit);
    const trends = games.ratingTrends(mode, rows.map((row) => row.user.id), trendSince());
    return rows.map((row) => ({ ...row, online: online.has(row.user.id), trend: trends.get(row.user.id) ?? 0 }));
  };

  /**
   * Login, signup and logout replace the session id (against session fixation). Anonymous seats, seeks and
   * challenges follow the browser to the new id, and sockets still holding the old identity are closed so they
   * reconnect with the new cookie.
   */
  const rotateSession = (ctx: Context, userId: string | null): Session => {
    const previous = ctx.session.id;
    const next = sessions.rotate(previous, userId, ctx.req.headers['user-agent']);
    games.rebindSession(previous, next.id);
    lobby.rebindSession(previous, next.id);
    ctx.setSession(next);
    for (const client of hub.clients()) {
      if (client.player.sessionId === previous) client.socket.close(4001, 'session changed');
    }
    return next;
  };

  /**
   * The Discord Activity: the site inside Discord, at `<application id>.discordsays.com`, reached through Discord's
   * proxy. Its requests come from that origin, and the page marks its own with `x-ligungi-activity`.
   */
  const activityOrigin = discord.clientId ? `https://${discord.clientId}.discordsays.com` : null;
  const fromActivity = (req: IncomingMessage): boolean =>
    activityOrigin !== null && (req.headers.origin === activityOrigin || req.headers['x-ligungi-activity'] === '1');
  const activities = new ActivityHalls(lobby, games, config.now);
  /** Who each Activity session is on Discord, to check they are in the call they play from; forgotten after a day unused. */
  const activityPlayers = new Map<string, { discordId: string; at: number }>();
  const rememberActivityPlayer = (sessionId: string, discordId: string) => {
    const limit = config.now() - 24 * 60 * 60 * 1000;
    for (const [id, entry] of activityPlayers) if (entry.at < limit) activityPlayers.delete(id);
    activityPlayers.set(sessionId, { discordId, at: config.now() });
  };
  const activityLimiter = new RateLimiter(30, 60_000, config.now);
  /** Races created or joined per session: enough to play race after race, too few to fill the server with them. */
  const raceLimiter = new RateLimiter(30, 60_000, config.now);
  // The page asks every few seconds what the call has going on, so this one allows more.
  const activityRoomsLimiter = new RateLimiter(120, 60_000, config.now);
  const ACTIVITY_INSTANCE = /^[\w-]{1,100}$/;
  /** Checks that the caller signed in through the Activity and is in the call they act on; returns that call. */
  const activityCaller = async (ctx: Context, instanceId: unknown): Promise<string> => {
    if (!activityOrigin) throw new HttpError(404, 'activityDisabled');
    const discordId = activityPlayers.get(ctx.session.id)?.discordId;
    if (!discordId) throw new HttpError(401, 'activitySignInRequired');
    rememberActivityPlayer(ctx.session.id, discordId);
    if (!activityLimiter.allow(ctx.session.id)) throw new HttpError(429, 'tooManyAttempts');
    if (typeof instanceId !== 'string' || !ACTIVITY_INSTANCE.test(instanceId)) throw new HttpError(400, 'notInActivity');
    const members = await discord.instanceUsers(instanceId);
    if (members && !members.has(discordId)) throw new HttpError(403, 'notInActivity');
    return instanceId;
  };

  /** Sends a user, on every device, the open challenges they received. */
  const sendIncoming = (userId: string): void => {
    for (const client of hub.clients()) {
      if (client.player.userId !== userId) continue;
      const challenges = lobby.incomingFor(userId).map((challenge) => lobby.challengeView(challenge, client.player));
      hub.send(client, { t: 'incoming', challenges });
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

  const userPayload = (session: Session) => {
    const player = toPlayer(session);
    return player.userId ? { id: player.userId, name: player.name } : null;
  };

  return {
    config,
    db,
    sessions,
    twoFactor,
    moderation,
    users,
    notices,
    hub,
    authLimiter,
    loginFailures,
    sessionLimiter,
    exportLimiter,
    reportLimiter,
    csp,
    activityCsp,
    toPlayer,
    sendTurns,
    sendNotices,
    notice,
    publishGame,
    discord,
    discordLimiter,
    games,
    tv,
    puzzles,
    racers,
    explorer,
    studies,
    studyLimiter,
    searchLimiter,
    tvGames,
    publishTv,
    lobbyView,
    publishLobby,
    challengeStore,
    seekStore,
    lobby,
    updatePresence,
    onlineUsers,
    onlineCount,
    playingByUser,
    requireUser,
    checkAccountCode,
    requireModerator,
    REPORT_LABELS,
    discordText,
    reasonOf,
    sanctionable,
    readableStudy,
    ownStudy,
    studyFields,
    checkedRoot,
    chapterInput,
    seatsBlocked,
    findUser,
    RANKING_PAGE_LIMIT,
    rankingView,
    playersView,
    trendSince,
    leaders,
    rotateSession,
    activityOrigin,
    fromActivity,
    activities,
    activityPlayers,
    rememberActivityPlayer,
    activityLimiter,
    raceLimiter,
    activityRoomsLimiter,
    ACTIVITY_INSTANCE,
    activityCaller,
    sendIncoming,
    closeSessionSockets,
    closeUserSockets,
    userPayload,
  };
};

export type AppDeps = ReturnType<typeof createDeps>;

export const createApp = (config: ServerConfig): App => {
  const deps = createDeps(config);
  const { activityCsp, activityOrigin, csp, db, discord, fromActivity, games, hub, lobby, lobbyView, publishLobby, racers, seatsBlocked, sendIncoming, sendNotices, sendTurns, sessionLimiter, sessions, toPlayer, tvGames, twoFactor, updatePresence } = deps;
  let closing = false;
  const router = new Router();
  registerAuthRoutes(router, deps);
  registerAccountRoutes(router, deps);
  registerDiscordActivityRoutes(router, deps);
  registerDiscordRoutes(router, deps);
  registerModerationRoutes(router, deps);
  registerStudiesRoutes(router, deps);
  registerCommunityRoutes(router, deps);
  registerPlayRoutes(router, deps);
  registerTrainingRoutes(router, deps);

  const sameOrigin = (req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    if (activityOrigin !== null && origin === activityOrigin) return true;
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
    const existing = sessions.get(parseCookies(req.headers.cookie).get(SESSION_COOKIE));
    if (existing) return existing;
    if (req.method === 'GET' && url.pathname !== '/api/me') return { id: `ephemeral:${randomId(24)}`, userId: null };
    if (!sessionLimiter.allow(ip)) throw new HttpError(429, 'tooManyAttempts');
    const created = sessions.create();
    res.setHeader('set-cookie', sessionCookie(created.id, config.secureCookies, fromActivity(req)));
    return created;
  };

  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    if (!url.pathname.startsWith('/api/')) {
      const shortLink = Object.hasOwn(SHORT_LINKS, url.pathname) ? SHORT_LINKS[url.pathname] : undefined;
      if (shortLink && (req.method === 'GET' || req.method === 'HEAD')) {
        res.writeHead(302, { location: shortLink, 'cache-control': 'no-store' });
        res.end();
        return;
      }
      // The Activity's page may only be framed by Discord: on its first load (Discord adds `frame_id`) and on a reload
      // inside its iframe. Everywhere else the site still refuses to be framed.
      const embedded = activityOrigin !== null && (url.searchParams.has('frame_id') || req.headers['sec-fetch-dest'] === 'iframe');
      res.setHeader('content-security-policy', embedded ? activityCsp : csp);
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
      setSession: (next) => res.setHeader('set-cookie', sessionCookie(next.id, config.secureCookies, fromActivity(req))),
    };
    await matched.handler(ctx);
  };

  /** Every failure ends in a response: one bad request must never take the process down. */
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) {
        if (!res.headersSent) sendError(res, error.status, error.code, error.details);
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
      const session = sessions.get(parseCookies(req.headers.cookie).get(SESSION_COOKIE));
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
    typeof topic === 'string' && (topic === 'lobby' || topic === 'tv' || /^(game|challenge|race):[A-Za-z0-9]{1,16}$/.test(topic));

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
      if (!hub.hasSession(player.sessionId)) {
        lobby.removeSeeksOf(player.sessionId);
        lobby.cancelDirectedOf(player.sessionId);
      }
      publishLobby();
    });
    if (player.userId) {
      sendIncoming(player.userId);
      sendTurns(player.userId);
      sendNotices(player.userId);
    }
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
        } else if (kind === 'tv') {
          hub.subscribe(client, topic);
          hub.send(client, { t: 'tv', games: tvGames() });
        } else if (kind === 'game' && id) {
          const room = games.get(id);
          if (!room) return error('gameNotFound');
          hub.subscribe(client, topic);
          updatePresence(room);
          hub.send(client, { t: 'game', game: room.view(client.player.sessionId, client.player.userId) });
        } else if (kind === 'race' && id) {
          const race = racers.view(id, client.player);
          if (!race) return error('raceNotFound');
          hub.subscribe(client, topic);
          hub.send(client, { t: 'race', race });
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
      case 'raceMove':
      case 'raceSkip': {
        if (typeof message.race !== 'string' || !Number.isInteger(message.puzzle)) return;
        // Late or stale moves (the race is over, or the player already moved on) are dropped: the next race view corrects the page.
        if (message.t === 'raceSkip') racers.skip(message.race, client.player, message.puzzle);
        else if (typeof message.move === 'string') racers.move(message.race, client.player, message.puzzle, message.move);
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
        else if (message.t === 'moretime') result = room.giveTime(color);
        else if (message.t === 'draw' || message.t === 'rematch' || message.t === 'takeback') {
          const action = message.action;
          if (action !== 'offer' && action !== 'accept' && action !== 'decline') result = 'invalidAction';
          else if (message.t === 'draw') result = room.draw(color, action);
          else if (message.t === 'takeback') result = room.takeback(color, action);
          else if (action !== 'decline' && seatsBlocked(room)) result = 'blockedPlayer';
          else result = room.rematch(color, action);
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

  const sweepAccounts = () => {
    sessions.sweep();
    twoFactor.sweep();
  };
  sweepAccounts();
  const sessionSweep = setInterval(sweepAccounts, SESSION_SWEEP_MS);
  sessionSweep.unref();

  const challengeSweep = setInterval(() => lobby.sweep(), CHALLENGE_SWEEP_MS);
  challengeSweep.unref();

  return {
    server,
    db,
    games,
    discord,
    close: () =>
      new Promise<void>((resolve) => {
        closing = true;
        clearInterval(heartbeat);
        clearInterval(sessionSweep);
        clearInterval(challengeSweep);
        for (const client of hub.clients()) client.socket.terminate();
        wss.close();
        server.close(() => {
          games.close();
          // A sync still talking to Discord writes its result before the database closes.
          void discord.idle().then(() => {
            db.close();
            resolve();
          });
        });
        server.closeAllConnections();
      }),
  };
};

import { MODES, type Mode } from '@ligungi/engine';
import {
  RECENT_GAMES,
  RECENT_PLAYERS,
  RATING_TREND_DAYS,
  DAY_MS,
  type LeaderEntry,
  ONLINE_LIST_MAX,
  RANKING_PAGE_SIZE,
  RANKING_QUERY_MAX,
  RATING_BAND,
  type ModeStanding,
  type OnlinePlayer,
  type PlayersView,
  type RankingView,
} from '@ligungi/protocol';
import type { ServerConfig } from './config.ts';
import type { Games } from './games.ts';
import type { Users } from './users.ts';

/** The site-wide counts and rating distribution on the players page are recomputed at most this often. */
const PLAYERS_CACHE_MS = 60_000;

/**
 * The players page, the ranking and the leaderboards, as their routes send them. The site-wide counts and the rating
 * spread are cached for a while, since every visit to the players page would otherwise read the whole history.
 */
export const createPlayerLists = ({
  config,
  users,
  games,
  onlineUsers,
  onlineCount,
}: {
  config: ServerConfig;
  users: Users;
  games: Games;
  onlineUsers: (viewerId: string | null) => Set<string>;
  onlineCount: (sessionId: string) => number;
}) => {
  let playersCache: {
    at: number;
    stats: Pick<PlayersView['counts'], 'gamesLastDay' | 'gamesTotal' | 'players'>;
    distribution: PlayersView['distribution'];
    ranks: Record<Mode, Map<string, number>>;
    recent: PlayersView['recent'];
  } | null = null;

  const RANKING_PAGE_LIMIT = 100_000;

  const rankingView = (requested: Mode | null, params: URLSearchParams, viewerId: string | null): RankingView => {
    const counts = users.rankings.rankedCounts();
    const standings = viewerId ? users.ratings(viewerId) : null;
    const modes = Object.fromEntries(
      MODES.map((m) => {
        const own = standings?.[m];
        const you: ModeStanding | null =
          viewerId && own && own.games > 0
            ? { rating: own.rating, provisional: own.provisional, games: own.games, rank: users.rankings.rank(viewerId, m) }
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
    const { rows, total } = users.rankings.rankingPage(mode, { query, followerId }, (page - 1) * RANKING_PAGE_SIZE, RANKING_PAGE_SIZE);
    const records = games.history.recordsIn(mode, rows.map((row) => row.user.id));
    const trends = games.history.ratingTrends(mode, rows.map((row) => row.user.id), trendSince());
    const online = onlineUsers(viewerId);
    const followed = new Set(viewerId ? users.social.following(viewerId).map((user) => user.id) : []);
    const place = viewerId ? users.rankings.rankingPlace(viewerId, mode) : null;
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
      const { recent, finished } = games.history.gameCounts(now - 24 * 3_600_000);
      const bands = (mode: Mode) => users.rankings.ratingDistribution(mode, RATING_BAND);
      playersCache = {
        at: now,
        stats: { gamesLastDay: recent, gamesTotal: finished, players: users.count() },
        distribution: { intro: bands('intro'), beginner: bands('beginner'), intermediate: bands('intermediate'), advanced: bands('advanced') },
        ranks: { intro: users.rankings.ranks('intro'), beginner: users.rankings.ranks('beginner'), intermediate: users.rankings.ranks('intermediate'), advanced: users.rankings.ranks('advanced') },
        recent: { games: games.history.recentlyFinished(RECENT_GAMES), players: users.newest(RECENT_PLAYERS) },
      };
    }
    const cache = playersCache;
    const ongoing = games.live();
    const playingIn = new Map<string, string>();
    for (const room of ongoing) for (const seat of Object.values(room.seats)) if (seat.userId) playingIn.set(seat.userId, room.id);
    const signedIn = [...onlineUsers(viewerId)];
    const ids = signedIn.slice(0, 500);
    const ratings = users.rankings.playedRatings(viewerId ? [...ids, viewerId] : ids);
    const followed = new Set(viewerId ? users.social.following(viewerId).map((user) => user.id) : []);
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
        canChallenge: viewerId !== null && users.social.canChallenge(viewerId, user.id),
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
    const rows = users.rankings.leaderboard(mode, limit);
    const trends = games.history.ratingTrends(mode, rows.map((row) => row.user.id), trendSince());
    return rows.map((row) => ({ ...row, online: online.has(row.user.id), trend: trends.get(row.user.id) ?? 0 }));
  };

  return { rankingView, playersView, leaders };
};

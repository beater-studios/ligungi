import type { Color, Mode } from '@ligungi/engine';
import type { GameCounts, GameSummary } from './games.ts';
import type { Country, ProfileDetails } from './profile.ts';
import type { UserRef } from './users.ts';

export interface RatingView {
  readonly rating: number;
  readonly deviation: number;
  readonly games: number;
  readonly provisional: boolean;
}

/** Results of a player's rated games in one mode. */
export interface ModeRecord {
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
}

/** A player's rating right after one rated game. */
export interface RatingPoint {
  readonly at: number;
  readonly rating: number;
  readonly change: number;
  readonly gameId: string;
}

/** Upper bounds, in moves played on the board after the draft, of the game length groups; the last one has none. */
export const GAME_LENGTHS: readonly (number | null)[] = [60, 120, null];

/** Most rating points a history returns: the latest ones. */
export const RATING_HISTORY_MAX = 2000;

/** A player's rated games in one mode (`GET /api/users/:name/stats/:mode`); voided games are left out. */
export interface ModeStats {
  readonly mode: Mode;
  /** Oldest first, at most `RATING_HISTORY_MAX`. */
  readonly history: readonly RatingPoint[];
  readonly peak: { readonly rating: number; readonly at: number } | null;
  readonly lowest: { readonly rating: number; readonly at: number } | null;
  readonly byColor: Readonly<Record<Color, ModeRecord>>;
  /** One record per `GAME_LENGTHS` group, in the same order. */
  readonly byLength: readonly ModeRecord[];
}

export interface UserProfile {
  readonly user: UserRef;
  readonly createdAt: number;
  readonly online: boolean;
  readonly ratings: Readonly<Record<Mode, RatingView>>;
  /** Leaderboard position per mode, `null` while provisional or without games. */
  readonly ranks: Readonly<Record<Mode, number | null>>;
  readonly counts: GameCounts;
  /** Wins, draws and losses of the rated games in each mode. */
  readonly records: Readonly<Record<Mode, ModeRecord>>;
  readonly followers: number;
  readonly following: number;
  /** Whether the viewer follows this user. */
  readonly followed: boolean;
  /** Whether the viewer blocked this user. */
  readonly blocked: boolean;
  /** Whether the viewer may challenge this user from the profile (signed in, not themselves, allowed by them). */
  readonly canChallenge: boolean;
  /** Whether the viewer may start following this user (signed in, not themselves, allowed by them). */
  readonly canFollow: boolean;
  readonly details: ProfileDetails;
  readonly playing: readonly GameSummary[];
  readonly recent: readonly GameSummary[];
}

export interface UserSearchResult {
  readonly user: UserRef;
  readonly online: boolean;
}

/** A followed player, as listed on the friends page. */
export interface FriendView {
  readonly user: UserRef;
  readonly online: boolean;
  /** Id of the game being played right now. */
  readonly playing: string | null;
  readonly ratings: Readonly<Record<Mode, RatingView>>;
  /** Whether the viewer may challenge them from their profile (allowed by their challenge setting). */
  readonly canChallenge: boolean;
}

export interface LeaderEntry {
  readonly user: UserRef;
  readonly country: Country | null;
  readonly rating: number;
  readonly games: number;
  readonly online: boolean;
  /** Rating points won or lost in the mode over the last `RATING_TREND_DAYS`. */
  readonly trend: number;
}

/** Players leave the leaderboard after this many days without a rated game in the mode, and come back with the next one. */
export const LEADERBOARD_ACTIVE_DAYS = 30;
/** The period of the rating trend shown on the leaderboards. */
export const RATING_TREND_DAYS = 7;

export type Leaderboard = Readonly<Record<Mode, readonly LeaderEntry[]>>;

export const LEADERBOARD_TOP = 10;

/** Width, in rating points, of each band of the rating distribution on the players page. */
export const RATING_BAND = 50;

/** A player's place in one mode. */
export interface ModeStanding {
  readonly rating: number;
  readonly provisional: boolean;
  /** Rated games played in the mode. */
  readonly games: number;
  /** Leaderboard position, `null` while provisional. */
  readonly rank: number | null;
}

export interface OnlinePlayer {
  readonly user: UserRef;
  readonly country: Country | null;
  /** Standing in each mode the player has rated games in. */
  readonly ratings: Readonly<Partial<Record<Mode, ModeStanding>>>;
  /** The game the player is in right now, if any. */
  readonly playing: string | null;
  /** Whether the viewer follows this player. */
  readonly followed: boolean;
  /** Whether the viewer may challenge this player from their profile (signed in, not themselves, allowed by them). */
  readonly canChallenge: boolean;
}

export interface RatingBand {
  /** Lowest rating of the band; the band covers `RATING_BAND` points. */
  readonly from: number;
  readonly players: number;
}

export interface PlayersView {
  /** Signed-in players online now, the free ones first, then by best rating. At most `ONLINE_LIST_MAX`. */
  readonly online: readonly OnlinePlayer[];
  readonly counts: {
    /** Connected browsers, signed in or not. */
    readonly online: number;
    /** Signed-in players online. */
    readonly signedIn: number;
    /** Signed-in players online and not in a game. */
    readonly free: number;
    readonly playing: number;
    readonly gamesLastDay: number;
    readonly gamesTotal: number;
    readonly players: number;
  };
  /** Players with rated games, per mode, in bands of `RATING_BAND` points. */
  readonly distribution: Readonly<Record<Mode, readonly RatingBand[]>>;
  /** The viewer's rating in each mode they have rated games in, for "you are here". */
  readonly you: Readonly<Partial<Record<Mode, number>>> | null;
  /** What happened lately: the latest finished games (voided ones aside) and the newest accounts, newest first. */
  readonly recent: {
    readonly games: readonly GameSummary[];
    readonly players: readonly NewPlayer[];
  };
}

/** An account in the players page's recent activity. */
export interface NewPlayer {
  readonly user: UserRef;
  readonly country: Country | null;
  readonly joinedAt: number;
}

/** How many finished games and new accounts the players page's recent activity lists. */
export const RECENT_GAMES = 8;
export const RECENT_PLAYERS = 6;

/** One row of a mode's full ranking. */
export interface RankingRow {
  /** Leaderboard position; tied ratings share it. */
  readonly rank: number;
  readonly user: UserRef;
  readonly country: Country | null;
  readonly rating: number;
  readonly games: number;
  readonly record: ModeRecord;
  readonly online: boolean;
  /** Whether the viewer follows this player. */
  readonly followed: boolean;
  /** Rating points won or lost in the mode over the last `RATING_TREND_DAYS`. */
  readonly trend: number;
}

export interface RankingView {
  readonly mode: Mode;
  /** Rows of the requested page, after the search and follow filters. */
  readonly rows: readonly RankingRow[];
  /** Rows matching the filters, over every page. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  /** Players on each mode's ranking, and the viewer's standing there when they have rated games in it. */
  readonly modes: Readonly<Record<Mode, { readonly players: number; readonly you: ModeStanding | null }>>;
  /** The viewer's place in this mode's unfiltered ranking and the page it is on; null when not ranked. */
  readonly you: { readonly rank: number; readonly page: number } | null;
}

export const RANKING_PAGE_SIZE = 50;
export const RANKING_QUERY_MAX = 30;

export const ONLINE_LIST_MAX = 100;
export const LEADERBOARD_MAX = 100;
export const MAX_FOLLOWS = 400;
/** Players one account may block. */
export const MAX_BLOCKS = 400;

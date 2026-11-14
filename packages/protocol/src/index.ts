import { MODES, MODE_RULES, type Color, type Mode, type Outcome } from '@ligungi/engine';
import type { ErrorCode } from './errors.ts';

export * from './errors.ts';

/** Seconds. */
export interface TimeControl {
  readonly initial: number;
  readonly increment: number;
}

export type ColorChoice = Color | 'random';

export interface GameSettings {
  readonly mode: Mode;
  readonly rated: boolean;
  /** `null` means no clock (casual games only). */
  readonly timeControl: TimeControl | null;
  /** Color of the player who creates the seek or challenge. */
  readonly color: ColorChoice;
  /** Color that places first in the draft and moves first in play. */
  readonly firstPlayer: ColorChoice;
  /**
   * Casual draft modes only: the draft ends when both players declare done, instead of the
   * rulebook rule where the second player's declaration ends it for both.
   */
  readonly freeDraft: boolean;
}

export const TIME_PRESETS: readonly TimeControl[] = [
  { initial: 300, increment: 3 },
  { initial: 600, increment: 5 },
  { initial: 900, increment: 10 },
  { initial: 1800, increment: 0 },
  { initial: 1800, increment: 20 },
  { initial: 3600, increment: 30 },
];

export const formatTimeControl = (tc: TimeControl | null): string =>
  tc ? `${tc.initial % 60 === 0 ? tc.initial / 60 : (tc.initial / 60).toFixed(1)}+${tc.increment}` : '∞';

export const sameTimeControl = (a: TimeControl | null, b: TimeControl | null): boolean =>
  a === b || (!!a && !!b && a.initial === b.initial && a.increment === b.increment);

export interface UserRef {
  readonly id: string;
  readonly name: string;
}

export interface PlayerView {
  readonly name: string;
  readonly user: UserRef | null;
  readonly rating: number | null;
  readonly provisional: boolean;
  readonly ratingDiff: number | null;
  readonly online: boolean;
}

export interface ClockView {
  /** Milliseconds left when the message was sent. */
  readonly white: number;
  readonly black: number;
  readonly running: Color | null;
}

export type GameStatus = 'started' | 'ended' | 'aborted';

export interface GameView {
  readonly id: string;
  readonly mode: Mode;
  readonly rated: boolean;
  readonly timeControl: TimeControl | null;
  readonly players: Readonly<Record<Color, PlayerView>>;
  readonly firstPlayer: Color;
  readonly freeDraft: boolean;
  /** Machine notation, see `moveToString` in the engine. */
  readonly moves: readonly string[];
  readonly status: GameStatus;
  readonly outcome: Outcome | null;
  readonly clock: ClockView | null;
  readonly drawOffer: Color | null;
  /** The player asking to take back their last move (casual games only). */
  readonly takebackOffer: Color | null;
  readonly rematchOffer: Color | null;
  readonly rematchId: string | null;
  /** Color of the viewer in this game, if any. */
  readonly you: Color | null;
  readonly canAbort: boolean;
  readonly canClaimVictory: boolean;
  /** Whether the viewer may ask to take back their last move now. */
  readonly canTakeback: boolean;
  /** Whether the viewer may give the opponent extra time now (a game with a clock, in progress). */
  readonly canGiveTime: boolean;
  readonly createdAt: number;
  readonly endedAt: number | null;
}

export interface GameSummary {
  readonly id: string;
  readonly mode: Mode;
  readonly rated: boolean;
  readonly timeControl: TimeControl | null;
  readonly players: Readonly<Record<Color, Pick<PlayerView, 'name' | 'user' | 'rating' | 'ratingDiff'>>>;
  readonly status: GameStatus;
  readonly outcome: Outcome | null;
  readonly plies: number;
  readonly fen: string;
  readonly createdAt: number;
  readonly endedAt: number | null;
  /** The clocks while the game is in progress; `null` without a clock or once it has ended. */
  readonly clock: ClockView | null;
}

export interface Opponent {
  readonly name: string;
  readonly user: UserRef | null;
  readonly rating: number | null;
}

export interface SeekView {
  readonly id: string;
  readonly settings: GameSettings;
  readonly player: Opponent;
  readonly mine: boolean;
  readonly createdAt: number;
}

export interface ChallengeView {
  readonly id: string;
  readonly settings: GameSettings;
  readonly challenger: Opponent;
  /** The player a challenge from a profile is meant for; `null` for an open link anyone can accept. */
  readonly destination: Opponent | null;
  readonly mine: boolean;
  readonly status: 'open' | 'accepted' | 'canceled' | 'declined';
  readonly gameId: string | null;
}

/** Who may challenge a player from their profile. */
export const CHALLENGE_POLICIES = ['everyone', 'following', 'nobody'] as const;
export type ChallengePolicy = (typeof CHALLENGE_POLICIES)[number];

export interface LobbyView {
  readonly seeks: readonly SeekView[];
  readonly playing: number;
  readonly online: number;
}

export interface RatingView {
  readonly rating: number;
  readonly deviation: number;
  readonly games: number;
  readonly provisional: boolean;
}

export interface GameCounts {
  readonly games: number;
  readonly rated: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

/** Results of a player's rated games in one mode. */
export interface ModeRecord {
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
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
  /** Whether the viewer may challenge this user from the profile (signed in, not themselves, allowed by them). */
  readonly canChallenge: boolean;
  readonly playing: readonly GameSummary[];
  readonly recent: readonly GameSummary[];
}

/** A signed-in session listed on the account page; `id` is a public handle, not the session secret. */
export interface SessionView {
  readonly id: string;
  readonly current: boolean;
  readonly createdAt: number;
  readonly seenAt: number;
  readonly userAgent: string | null;
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
}

export interface LeaderEntry {
  readonly user: UserRef;
  readonly rating: number;
  readonly games: number;
  readonly online: boolean;
}

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
}

/** One row of a mode's full ranking. */
export interface RankingRow {
  /** Leaderboard position; tied ratings share it. */
  readonly rank: number;
  readonly user: UserRef;
  readonly rating: number;
  readonly games: number;
  readonly record: ModeRecord;
  readonly online: boolean;
  /** Whether the viewer follows this player. */
  readonly followed: boolean;
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

export type ResultFilter = 'win' | 'loss' | 'draw';

/** Filters for a player's game history; every field is optional. */
export interface GameFilters {
  readonly mode?: Mode;
  readonly result?: ResultFilter;
  readonly rated?: boolean;
  readonly color?: Color;
  /** Opponent username. */
  readonly vs?: string;
}

const RESULTS: readonly string[] = ['win', 'loss', 'draw'];

/** Reads history filters from a query string; unknown values are an error, empty ones are ignored. */
export const parseGameFilters = (params: URLSearchParams): GameFilters | ErrorCode => {
  const filters: { -readonly [K in keyof GameFilters]: GameFilters[K] } = {};
  const mode = params.get('mode');
  if (mode) {
    if (!(MODES as readonly string[]).includes(mode)) return 'invalidFilter';
    filters.mode = mode as Mode;
  }
  const result = params.get('result');
  if (result) {
    if (!RESULTS.includes(result)) return 'invalidFilter';
    filters.result = result as ResultFilter;
  }
  const rated = params.get('rated');
  if (rated) {
    if (rated !== '1' && rated !== '0') return 'invalidFilter';
    filters.rated = rated === '1';
  }
  const color = params.get('color');
  if (color) {
    if (color !== 'white' && color !== 'black') return 'invalidFilter';
    filters.color = color;
  }
  const vs = params.get('vs')?.trim();
  if (vs) {
    if (vs.length > 20) return 'invalidFilter';
    filters.vs = vs;
  }
  return filters;
};

/** Inverse of `parseGameFilters`, for links and requests. */
export const gameFiltersQuery = (filters: GameFilters): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.result) params.set('result', filters.result);
  if (filters.rated !== undefined) params.set('rated', filters.rated ? '1' : '0');
  if (filters.color) params.set('color', filters.color);
  if (filters.vs) params.set('vs', filters.vs);
  return params;
};

export interface Me {
  readonly user: UserRef | null;
  readonly playing: readonly GameSummary[];
}

/** Seconds a player gives the opponent with the "extra time" button, as on lichess. */
export const EXTRA_TIME_SECONDS = 15;

export type Topic = 'lobby' | `game:${string}` | `challenge:${string}`;

export type ClientMessage =
  | { readonly t: 'sub'; readonly topic: Topic }
  | { readonly t: 'unsub'; readonly topic: Topic }
  | { readonly t: 'move'; readonly game: string; readonly move: string; readonly ply: number }
  | { readonly t: 'resign' | 'abort' | 'claim'; readonly game: string }
  | { readonly t: 'draw' | 'rematch' | 'takeback'; readonly game: string; readonly action: 'offer' | 'accept' | 'decline' }
  /** Adds `EXTRA_TIME_SECONDS` to the opponent's clock. */
  | { readonly t: 'moretime'; readonly game: string }
  | { readonly t: 'ping' };

export type ServerMessage =
  | { readonly t: 'game'; readonly game: GameView }
  | { readonly t: 'lobby'; readonly lobby: LobbyView }
  | { readonly t: 'challenge'; readonly challenge: ChallengeView }
  /** The open challenges sent to the user, on connecting and after every change. */
  | { readonly t: 'incoming'; readonly challenges: readonly ChallengeView[] }
  | { readonly t: 'redirect'; readonly path: string }
  | { readonly t: 'error'; readonly code: ErrorCode; readonly message: string }
  | { readonly t: 'pong' };

const COLOR_CHOICES: readonly string[] = ['white', 'black', 'random'];

/** Validates user input for a new game. Returns an error code when invalid. */
export const parseSettings = (input: unknown): GameSettings | ErrorCode => {
  if (typeof input !== 'object' || input === null) return 'invalidSettings';
  const value = input as Record<string, unknown>;
  if (!(MODES as readonly unknown[]).includes(value.mode)) return 'invalidMode';
  if (typeof value.rated !== 'boolean') return 'invalidRated';
  if (!COLOR_CHOICES.includes(value.color as string)) return 'invalidColor';
  if (!COLOR_CHOICES.includes(value.firstPlayer as string)) return 'invalidFirstPlayer';
  let timeControl: TimeControl | null = null;
  if (value.timeControl !== null) {
    const tc = value.timeControl as Record<string, unknown> | undefined;
    const initial = Number(tc?.initial);
    const increment = Number(tc?.increment);
    if (!Number.isInteger(initial) || initial < 60 || initial > 3 * 3600) return 'invalidInitialTime';
    if (!Number.isInteger(increment) || increment < 0 || increment > 180) return 'invalidIncrement';
    timeControl = { initial, increment };
  }
  if (value.rated && !timeControl) return 'unlimitedNotRated';
  if (value.freeDraft !== undefined && typeof value.freeDraft !== 'boolean') return 'invalidDraftOption';
  const freeDraft = value.freeDraft === true && MODE_RULES[value.mode as Mode].draft;
  if (value.rated && freeDraft) return 'ratedNeedsOfficialDraft';
  return {
    mode: value.mode as Mode,
    rated: value.rated,
    timeControl,
    color: value.color as ColorChoice,
    firstPlayer: value.firstPlayer as ColorChoice,
    freeDraft,
  };
};

export const parseClientMessage = (raw: string): ClientMessage | undefined => {
  try {
    const message = JSON.parse(raw) as ClientMessage;
    return typeof message === 'object' && message !== null && typeof message.t === 'string' ? message : undefined;
  } catch {
    return undefined;
  }
};

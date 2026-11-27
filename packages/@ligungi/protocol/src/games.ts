import { MODES, type Color, type Mode, type Outcome } from '@ligungi/engine';
import type { TimeControl } from './time.ts';
import type { UserRef } from './users.ts';

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
  /** White for every new game; games created before White always started may say black. */
  readonly firstPlayer: Color;
  readonly freeDraft: boolean;
  /** Machine notation, see `moveToString` in the engine. */
  readonly moves: readonly string[];
  readonly status: GameStatus;
  readonly outcome: Outcome | null;
  readonly clock: ClockView | null;
  /** Correspondence: days per move, see `GameSettings`. */
  readonly daysPerMove: number | null;
  /** Correspondence: milliseconds the player to move had left when the message was sent; `null` once the game is over. */
  readonly deadlineIn: number | null;
  readonly drawOffer: Color | null;
  /** The player asking to take back their last move (casual games only). */
  readonly takebackOffer: Color | null;
  /** A moderator voided the game (won by cheating): its rating changes were undone. */
  readonly voided: boolean;
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
  /**
   * Correspondence draft: the viewer's own queued placements (machine notation), played one per turn by the server.
   * Empty for everyone else: the queue is the player's plan, never shown to the opponent.
   */
  readonly draftQueue: readonly string[];
  /** The Arena this game was paired in, if any. */
  readonly arena: string | null;
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
  readonly daysPerMove: number | null;
  /** Correspondence: milliseconds the player to move had left; `null` once the game is over. */
  readonly deadlineIn: number | null;
  /** Whose move it is; `null` once the game is over. */
  readonly turn: Color | null;
  readonly voided: boolean;
  /** The Arena this game was paired in, if any. */
  readonly arena: string | null;
}

/** TV channels: the strongest live game of the site, and of each mode. */
export const TV_CHANNELS = ['best', ...MODES] as const;
export type TvChannel = (typeof TV_CHANNELS)[number];

/** The game a TV channel shows, kept until it ends and for a few seconds after; `null` when nothing is being played. */
export interface TvChannelView {
  readonly channel: TvChannel;
  readonly game: GameSummary | null;
}

export interface GameCounts {
  readonly games: number;
  readonly rated: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

/** A private note on a bookmarked game holds up to this many characters. */
export const BOOKMARK_NOTE_MAX = 1000;
/** How many bookmarked games `GET /api/bookmarks` returns at most. */
export const BOOKMARKS_MAX = 200;

/** Whether the viewer bookmarked a game, and their private note on it (empty without one). */
export interface BookmarkView {
  readonly bookmarked: boolean;
  readonly note: string;
}

/** A game the player bookmarked, with their note, newest bookmark first. */
export interface BookmarkedGame {
  readonly game: GameSummary;
  readonly note: string;
  readonly bookmarkedAt: number;
}

/** The record between two players (lichess's crosstable): every finished game they played against each other. */
export interface Crosstable {
  readonly users: readonly [UserRef, UserRef];
  /** Wins of each user, in the order of `users`. */
  readonly wins: readonly [number, number];
  readonly draws: number;
  /** The latest games between them, oldest first: who won, as an index into `users`, or `null` for a draw. */
  readonly recent: readonly { readonly id: string; readonly winner: 0 | 1 | null }[];
}

/** How many of the latest games between two players a crosstable lists. */
export const CROSSTABLE_RECENT = 10;

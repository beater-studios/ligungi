import type { Color, Mode, Outcome, Role } from '@ligungi/engine';
import type { ModeRecord, UserRef } from './index.ts';

/** Days of activity a profile shows. */
export const ACTIVITY_DAYS = 30;
/** Most events an activity answer holds, newest first. */
export const ACTIVITY_MAX = 1000;
/** Days of the followed players' activity in the feed, and the most items it holds. */
export const FEED_DAYS = 7;
export const FEED_MAX = 40;

/** A finished game from one player's side, read from its row (no position, so lists of them stay cheap). */
export interface ActivityGame {
  readonly id: string;
  readonly mode: Mode;
  readonly rated: boolean;
  readonly color: Color;
  readonly result: 'win' | 'loss' | 'draw';
  readonly reason: Outcome['reason'];
  readonly ratingDiff: number | null;
  readonly opponent: { readonly name: string; readonly user: UserRef | null };
}

/**
 * One thing a player did. Games, public studies and joining are public; puzzles, lessons, practice and puzzle runs are
 * only in the player's own activity, as the rest of their training.
 */
export type ActivityEvent =
  | { readonly kind: 'game'; readonly at: number; readonly game: ActivityGame }
  | { readonly kind: 'study'; readonly at: number; readonly study: { readonly id: string; readonly title: string } }
  | { readonly kind: 'joined'; readonly at: number }
  | { readonly kind: 'puzzle'; readonly at: number; readonly win: boolean; readonly change: number | null }
  | { readonly kind: 'lesson'; readonly at: number; readonly stars: number }
  | { readonly kind: 'practice'; readonly at: number }
  | { readonly kind: 'run'; readonly at: number; readonly run: 'streak' | 'storm'; readonly score: number };

/** `GET /api/users/:name/activity`: the last `ACTIVITY_DAYS` days, newest first. */
export interface ActivityView {
  readonly events: readonly ActivityEvent[];
  /** The viewer is the player, so the private kinds are included. */
  readonly mine: boolean;
}

/** `GET /api/feed`: what the players the viewer follows did lately, newest first. */
export interface FeedItem {
  readonly user: UserRef;
  readonly event: Extract<ActivityEvent, { kind: 'game' | 'study' }>;
}

/** Bounds of the rating difference groups (opponent minus player) of the insights, lowest first; the last one has none. */
export const OPPONENT_BANDS: readonly (number | null)[] = [-200, -50, 50, 200, null];
export const HELD_GROUPS: readonly (number | null)[] = [2, 5, null];
export type Pace = 'none' | 'clock' | 'correspondence';
export const PACES: readonly Pace[] = ['clock', 'none', 'correspondence'];
export const INSIGHT_OPPONENTS = 5;

/**
 * A player's rated games in one mode, looked at from several sides (`GET /api/users/:name/insights/:mode`). Voided
 * games are left out; at most the latest `RATING_HISTORY_MAX`.
 */
export interface InsightsView {
  readonly mode: Mode;
  readonly games: number;
  /** One record per `OPPONENT_BANDS` group, by how much stronger the opponent was at the start. */
  readonly byOpponent: readonly ModeRecord[];
  /** How the games ended, counted for the wins, the draws and the losses. */
  readonly endings: Readonly<Record<'win' | 'draw' | 'loss', Partial<Record<Outcome['reason'], number>>>>;
  readonly byPace: Readonly<Record<Pace, ModeRecord>>;
  /** Average moves on the board after the draft, by result; `null` without games of that result. */
  readonly length: Readonly<Record<'win' | 'draw' | 'loss', number | null>>;
  /** The most played opponents with an account, most games first. */
  readonly opponents: ReadonlyArray<{ readonly user: UserRef; readonly record: ModeRecord }>;
  /** Draft modes: the pieces the player places on average per game, and the results by pieces still in hand when play starts. */
  readonly draft: {
    readonly placed: Readonly<Partial<Record<Role, number>>>;
    /** One record per `HELD_GROUPS` group. */
    readonly byHeld: readonly ModeRecord[];
  } | null;
}

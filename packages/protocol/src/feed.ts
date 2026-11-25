import type { Color, Mode, Outcome } from '@ligungi/engine';
import type { UserRef } from './index.ts';

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

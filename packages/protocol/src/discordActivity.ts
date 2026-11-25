import type { GameSummary } from './games.ts';
import type { GameSettings } from './lobby.ts';
import type { RaceStatus } from './racer.ts';
import type { TimeControl } from './time.ts';
import type { Opponent } from './users.ts';

/** The clocks a room in a Discord Activity call may use: casual games short enough to finish while the call lasts. */
export const ACTIVITY_TIME_CONTROLS: readonly TimeControl[] = [
  { initial: 180, increment: 2 },
  { initial: 300, increment: 3 },
  { initial: 600, increment: 5 },
  { initial: 900, increment: 10 },
];

/** A room in a Discord Activity call: a challenge waiting for someone in the call to join it. */
export interface ActivityRoomView {
  readonly challengeId: string;
  readonly settings: GameSettings;
  readonly challenger: Opponent;
  readonly mine: boolean;
}

/** What a voice call running the Discord Activity has going on: rooms waiting for a second player, oldest first, and games in progress. */
export interface ActivityHallView {
  readonly rooms: readonly ActivityRoomView[];
  readonly games: readonly GameSummary[];
  /** The call's Puzzle Racer race that can still be joined, or the one going on. */
  readonly race: { readonly id: string; readonly status: RaceStatus; readonly players: number } | null;
}

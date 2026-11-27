import type { ArenaView } from './arena.ts';
import type { ErrorCode } from './errors.ts';
import type { GameSummary, GameView } from './games.ts';
import type { ChallengeView, LobbyView } from './lobby.ts';
import type { NoticeView } from './notices.ts';
import type { RaceView } from './racer.ts';

/** `tv`: the live games the TV and the home page show, sent on subscribing and again whenever one of them changes. */
export type Topic = 'lobby' | 'tv' | `game:${string}` | `challenge:${string}` | `race:${string}` | `arena:${string}`;

export type ClientMessage =
  | { readonly t: 'sub'; readonly topic: Topic }
  | { readonly t: 'unsub'; readonly topic: Topic }
  | { readonly t: 'move'; readonly game: string; readonly move: string; readonly ply: number }
  | { readonly t: 'resign' | 'abort' | 'claim'; readonly game: string }
  | { readonly t: 'draw' | 'rematch' | 'takeback'; readonly game: string; readonly action: 'offer' | 'accept' | 'decline' }
  /** Adds `EXTRA_TIME_SECONDS` to the opponent's clock. */
  | { readonly t: 'moretime'; readonly game: string }
  /** Correspondence draft: the placements (and "done") to play on the sender's next turns, replacing any queue before. */
  | { readonly t: 'queue'; readonly game: string; readonly moves: readonly string[] }
  /** A move in a Puzzle Racer race, on the puzzle at `puzzle` in the race's list; `skip` gives up that puzzle once per race. */
  | { readonly t: 'raceMove'; readonly race: string; readonly puzzle: number; readonly move: string }
  | { readonly t: 'raceSkip'; readonly race: string; readonly puzzle: number }
  | { readonly t: 'ping' };

export type ServerMessage =
  | { readonly t: 'game'; readonly game: GameView }
  | { readonly t: 'race'; readonly race: RaceView }
  /** An Arena's standings and games, on subscribing to `arena:<id>` and after every change. */
  | { readonly t: 'arena'; readonly arena: ArenaView }
  | { readonly t: 'lobby'; readonly lobby: LobbyView }
  /** Live games with at least one move, strongest first (as `GET /api/tv`). */
  | { readonly t: 'tv'; readonly games: readonly GameSummary[] }
  | { readonly t: 'challenge'; readonly challenge: ChallengeView }
  /** The open challenges sent to the user, on connecting and after every change. */
  | { readonly t: 'incoming'; readonly challenges: readonly ChallengeView[] }
  /** The user's correspondence games waiting for their move, on connecting and after every change to one of them. */
  | { readonly t: 'turns'; readonly games: readonly GameSummary[] }
  /** The user's latest notices (followers, moderation), on connecting and after every change. */
  | { readonly t: 'notices'; readonly notices: readonly NoticeView[] }
  | { readonly t: 'redirect'; readonly path: string }
  | { readonly t: 'error'; readonly code: ErrorCode; readonly message: string }
  | { readonly t: 'pong' };

export const parseClientMessage = (raw: string): ClientMessage | undefined => {
  try {
    const message = JSON.parse(raw) as ClientMessage;
    return typeof message === 'object' && message !== null && typeof message.t === 'string' ? message : undefined;
  } catch {
    return undefined;
  }
};

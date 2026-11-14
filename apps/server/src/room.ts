import {
  Game,
  initialPosition,
  moveToString,
  opposite,
  parseMove,
  toFen,
  type Color,
  type Mode,
  type Outcome,
} from '@ligungi/engine';
import { EXTRA_TIME_SECONDS, type ErrorCode, type GameStatus, type GameSummary, type GameView, type PlayerView, type TimeControl } from '@ligungi/protocol';
import { Clock } from './clock.ts';

export interface Seat {
  readonly sessionId: string;
  readonly userId: string | null;
  readonly name: string;
  readonly rating: number | null;
  readonly provisional: boolean;
  ratingDiff: number | null;
}

export interface RoomInit {
  readonly id: string;
  readonly mode: Mode;
  readonly rated: boolean;
  readonly timeControl: TimeControl | null;
  readonly firstPlayer: Color;
  readonly freeDraft: boolean;
  readonly seats: Record<Color, Seat>;
  readonly createdAt: number;
  readonly moves?: readonly string[];
  readonly status?: GameStatus;
  readonly outcome?: Outcome | null;
  readonly clock?: { white: number; black: number; running: Color | null } | null;
  readonly rematchId?: string | null;
  readonly endedAt?: number | null;
}

export interface RoomHooks {
  readonly now: () => number;
  readonly abortAfterMs: number;
  readonly claimAfterMs: number;
  /** Something visible changed: broadcast and persist. */
  readonly onChange: (room: GameRoom) => void;
  /** The game just ended (not aborted): update ratings before the final broadcast. */
  readonly onEnd: (room: GameRoom) => void;
  /** Both players asked for a rematch: create it and return its id. */
  readonly onRematch: (room: GameRoom) => string;
}

export type Action = 'offer' | 'accept' | 'decline';

const REPLAY_ERROR = 'Stored game cannot be replayed';

export class GameRoom {
  readonly id: string;
  readonly mode: Mode;
  readonly rated: boolean;
  readonly timeControl: TimeControl | null;
  readonly firstPlayer: Color;
  readonly freeDraft: boolean;
  readonly seats: Record<Color, Seat>;
  readonly createdAt: number;
  readonly game: Game;
  readonly clock: Clock | null;
  status: GameStatus;
  outcome: Outcome | null;
  drawOffer: Color | null = null;
  takebackOffer: Color | null = null;
  rematchOffer: Color | null = null;
  rematchId: string | null;
  endedAt: number | null;
  readonly #absentSince: Record<Color, number | null>;
  readonly #hooks: RoomHooks;
  #turnStartedAt: number;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(init: RoomInit, hooks: RoomHooks) {
    this.id = init.id;
    this.mode = init.mode;
    this.rated = init.rated;
    this.timeControl = init.timeControl;
    this.firstPlayer = init.firstPlayer;
    this.freeDraft = init.freeDraft;
    this.seats = init.seats;
    this.createdAt = init.createdAt;
    this.#hooks = hooks;
    this.game = new Game(initialPosition(init.mode, init.firstPlayer, { freeDraft: init.freeDraft }));
    for (const text of init.moves ?? []) {
      const move = parseMove(text);
      if (!move) throw new Error(`${REPLAY_ERROR}: ${init.id}`);
      this.game.play(move);
    }
    this.status = init.status ?? 'started';
    this.outcome = init.outcome ?? null;
    this.rematchId = init.rematchId ?? null;
    this.endedAt = init.endedAt ?? null;
    const now = hooks.now();
    this.#turnStartedAt = now;
    this.#absentSince = { white: now, black: now };
    this.clock = init.timeControl ? new Clock(init.timeControl, init.clock ?? undefined) : null;
    if (this.clock && init.clock?.running && this.status === 'started') this.clock.start(init.clock.running, now);
    this.#schedule();
  }

  get plies(): number {
    return this.game.moves.length;
  }

  colorOf(sessionId: string, userId: string | null): Color | null {
    for (const color of ['white', 'black'] as const) {
      const seat = this.seats[color];
      if (seat.sessionId === sessionId || (userId !== null && seat.userId === userId)) return color;
    }
    return null;
  }

  canAbort(): boolean {
    return this.status === 'started' && this.plies < 2;
  }

  canClaim(color: Color): boolean {
    const since = this.#absentSince[opposite(color)];
    return (
      this.status === 'started' &&
      this.plies >= 2 &&
      since !== null &&
      this.#hooks.now() - since >= this.#hooks.claimAfterMs
    );
  }

  move(color: Color, text: string, ply: number): ErrorCode | null {
    if (this.status !== 'started') return 'gameOver';
    // A move that arrives after the flag but before the timer fires must not save the player.
    if (this.clock?.running === color && this.clock.timeLeft(color, this.#hooks.now()) <= 0) {
      this.tick();
      return 'gameOver';
    }
    if (this.game.position.turn !== color) return 'notYourTurn';
    if (ply !== this.plies) return 'staleMove';
    const move = parseMove(text);
    if (!move) return 'invalidMove';
    try {
      this.game.play(move);
    } catch {
      return 'illegalMove';
    }
    const now = this.#hooks.now();
    const next = this.game.position.turn;
    if (this.clock) {
      if (this.clock.running) this.clock.press(color, next, now);
      else if (this.plies >= 2) this.clock.start(next, now);
    }
    this.#turnStartedAt = now;
    if (this.drawOffer && this.drawOffer !== color) this.drawOffer = null;
    // A takeback request is about the position it was made in; any move makes it moot.
    this.takebackOffer = null;
    if (this.game.outcome) this.#end(this.game.outcome);
    else this.#changed();
    return null;
  }

  resign(color: Color): ErrorCode | null {
    if (this.status !== 'started') return 'gameOver';
    if (this.canAbort()) return this.abort(color);
    this.game.resign(color);
    this.#end(this.game.outcome!);
    return null;
  }

  abort(_color: Color): ErrorCode | null {
    if (!this.canAbort()) return 'cannotAbort';
    this.#finish('aborted', null);
    return null;
  }

  claim(color: Color): ErrorCode | null {
    if (!this.canClaim(color)) return 'cannotClaim';
    this.game.abandon(opposite(color));
    this.#end(this.game.outcome!);
    return null;
  }

  draw(color: Color, action: Action): ErrorCode | null {
    if (this.status !== 'started' || this.plies < 2) return 'drawUnavailable';
    const opponentOffered = this.drawOffer === opposite(color);
    if ((action === 'offer' || action === 'accept') && opponentOffered) {
      this.game.agreeDraw();
      this.#end(this.game.outcome!);
      return null;
    }
    if (action === 'offer') this.drawOffer = color;
    else if (action === 'decline' && opponentOffered) this.drawOffer = null;
    else return 'noDrawOffer';
    this.#changed();
    return null;
  }

  /**
   * How many moves a takeback by `color` removes: back to just before their last move, so it is their turn again.
   * Usually one (they just moved) or two (the opponent replied); in the draft a player may have placed several pieces
   * in a row after the opponent declared done, and only the last one goes.
   */
  #takebackCount(color: Color): number {
    const { moves, positions } = this.game;
    for (let i = moves.length - 1; i >= 0; i--) if (positions[i]!.turn === color) return moves.length - i;
    return 0;
  }

  /**
   * Casual games only, so a rating never depends on a favor. The first two moves stay: before them the game can still
   * be aborted and the clocks have not started, and taking back into that state would reopen both.
   */
  canTakeback(color: Color): boolean {
    if (this.rated || this.status !== 'started') return false;
    const count = this.#takebackCount(color);
    return count > 0 && this.plies - count >= 2;
  }

  takeback(color: Color, action: Action): ErrorCode | null {
    if (this.status !== 'started') return 'takebackUnavailable';
    const requester = opposite(color);
    // Unlike a draw, asking while the opponent asks is not an answer: each request is about a different move.
    if (action === 'accept' && this.takebackOffer === requester) {
      this.takebackOffer = null;
      if (!this.canTakeback(requester)) {
        this.#changed();
        return 'takebackUnavailable';
      }
      this.#undo(requester);
      return null;
    }
    if (action === 'offer') {
      if (this.takebackOffer === requester || !this.canTakeback(color)) return 'takebackUnavailable';
      this.takebackOffer = color;
    } else if (action === 'decline' && this.takebackOffer === requester) {
      this.takebackOffer = null;
    } else {
      return 'noTakebackOffer';
    }
    this.#changed();
    return null;
  }

  canGiveTime(_color: Color): boolean {
    return this.status === 'started' && this.clock !== null;
  }

  /** Adds a few seconds to the opponent's clock, as lichess's "give more time". Allowed in rated games too: it only helps the opponent. */
  giveTime(color: Color): ErrorCode | null {
    if (!this.canGiveTime(color)) return 'extraTimeUnavailable';
    // An opponent whose flag already fell is not saved by a gift that arrives before the timer fires.
    const running = this.clock!.running;
    if (running && this.clock!.timeLeft(running, this.#hooks.now()) <= 0) {
      this.tick();
      return 'gameOver';
    }
    this.clock!.add(opposite(color), EXTRA_TIME_SECONDS * 1000);
    this.#changed();
    return null;
  }

  rematch(color: Color, action: Action): ErrorCode | null {
    if (this.status !== 'ended' || this.rematchId) return 'rematchUnavailable';
    const opponentOffered = this.rematchOffer === opposite(color);
    if ((action === 'offer' || action === 'accept') && opponentOffered) {
      this.rematchOffer = null;
      this.rematchId = this.#hooks.onRematch(this);
    } else if (action === 'offer') {
      this.rematchOffer = color;
    } else if (action === 'decline' && opponentOffered) {
      this.rematchOffer = null;
    } else {
      return 'noRematchOffer';
    }
    this.#changed();
    return null;
  }

  /** Called by the hub whenever a player's sockets connect to or leave the game. */
  setPresence(color: Color, online: boolean): void {
    const current = this.#absentSince[color];
    if (online === (current === null)) return;
    this.#absentSince[color] = online ? null : this.#hooks.now();
    this.#schedule();
    this.#hooks.onChange(this);
  }

  /** Checks flags and deadlines. Runs from timers, and can be called directly. */
  tick(): void {
    if (this.status !== 'started') return;
    const now = this.#hooks.now();
    const running = this.clock?.running;
    if (running && this.clock!.timeLeft(running, now) <= 0) {
      this.game.timeout(running);
      this.#end(this.game.outcome!);
      return;
    }
    if (this.plies < 2 && now - this.#turnStartedAt >= this.#hooks.abortAfterMs) {
      this.#finish('aborted', null);
      return;
    }
    this.#schedule();
    this.#hooks.onChange(this);
  }

  /**
   * Moves anonymous seats from one session to another when the session id rotates (login, signup, logout), so a
   * player keeps their game. Seats of signed-in players are matched by user id and need no change.
   */
  rebindSession(from: string, to: string): boolean {
    let changed = false;
    for (const color of ['white', 'black'] as const) {
      const seat = this.seats[color];
      if (seat.sessionId === from && seat.userId === null) {
        this.seats[color] = { ...seat, sessionId: to };
        changed = true;
      }
    }
    if (changed) this.#hooks.onChange(this);
    return changed;
  }

  dispose(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  view(sessionId: string, userId: string | null): GameView {
    const you = this.colorOf(sessionId, userId);
    const now = this.#hooks.now();
    return {
      id: this.id,
      mode: this.mode,
      rated: this.rated,
      timeControl: this.timeControl,
      players: { white: this.#playerView('white'), black: this.#playerView('black') },
      firstPlayer: this.firstPlayer,
      freeDraft: this.freeDraft,
      moves: this.game.moves.map(moveToString),
      status: this.status,
      outcome: this.outcome,
      clock: this.clock?.view(now) ?? null,
      drawOffer: this.drawOffer,
      takebackOffer: this.takebackOffer,
      rematchOffer: this.rematchOffer,
      rematchId: this.rematchId,
      you,
      canAbort: you !== null && this.canAbort(),
      canClaimVictory: you !== null && this.canClaim(you),
      canTakeback: you !== null && this.canTakeback(you),
      canGiveTime: you !== null && this.canGiveTime(you),
      createdAt: this.createdAt,
      endedAt: this.endedAt,
    };
  }

  summary(): GameSummary {
    const player = (color: Color) => {
      const { name, rating, ratingDiff } = this.#playerView(color);
      const seat = this.seats[color];
      return { name, rating, ratingDiff, user: seat.userId ? { id: seat.userId, name: seat.name } : null };
    };
    return {
      id: this.id,
      mode: this.mode,
      rated: this.rated,
      timeControl: this.timeControl,
      players: { white: player('white'), black: player('black') },
      status: this.status,
      outcome: this.outcome,
      plies: this.plies,
      fen: toFen(this.game.position),
      createdAt: this.createdAt,
      endedAt: this.endedAt,
      clock: this.status === 'started' ? (this.clock?.view(this.#hooks.now()) ?? null) : null,
    };
  }

  #playerView(color: Color): PlayerView {
    const seat = this.seats[color];
    return {
      name: seat.name,
      user: seat.userId ? { id: seat.userId, name: seat.name } : null,
      rating: seat.rating,
      provisional: seat.provisional,
      ratingDiff: seat.ratingDiff,
      online: this.#absentSince[color] === null,
    };
  }

  /** Takes back `color`'s last move and anything after it. The time already spent stays spent, as on lichess. */
  #undo(color: Color): void {
    const count = this.#takebackCount(color);
    for (let i = 0; i < count; i++) this.game.undo();
    const now = this.#hooks.now();
    if (this.clock?.running) {
      this.clock.stop(now);
      this.clock.start(this.game.position.turn, now);
    }
    this.#turnStartedAt = now;
    this.drawOffer = null;
    this.#changed();
  }

  #end(outcome: Outcome): void {
    this.#finish('ended', outcome);
  }

  #finish(status: GameStatus, outcome: Outcome | null): void {
    const now = this.#hooks.now();
    this.status = status;
    this.outcome = outcome;
    this.endedAt = now;
    this.drawOffer = null;
    this.takebackOffer = null;
    this.clock?.stop(now);
    this.dispose();
    if (status === 'ended') this.#hooks.onEnd(this);
    this.#hooks.onChange(this);
  }

  #changed(): void {
    this.#schedule();
    this.#hooks.onChange(this);
  }

  #schedule(): void {
    this.dispose();
    if (this.status !== 'started') return;
    const now = this.#hooks.now();
    const deadlines: number[] = [];
    const running = this.clock?.running;
    if (running) deadlines.push(now + this.clock!.timeLeft(running, now));
    if (this.plies < 2) deadlines.push(this.#turnStartedAt + this.#hooks.abortAfterMs);
    for (const color of ['white', 'black'] as const) {
      const since = this.#absentSince[color];
      if (since !== null && this.plies >= 2) {
        const at = since + this.#hooks.claimAfterMs;
        if (at > now) deadlines.push(at);
      }
    }
    if (deadlines.length === 0) return;
    const delay = Math.max(0, Math.min(...deadlines) - now) + 20;
    this.#timer = setTimeout(() => this.tick(), delay);
    this.#timer.unref?.();
  }
}

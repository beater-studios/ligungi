import type { Color } from '@ligungi/engine';
import { isByoyomi, type ClockView, type TimeControl } from '@ligungi/protocol';

/**
 * A game clock. `remaining` is each side's time until the flag falls. With a Fischer clock that is the time left, and
 * every move adds the increment. With byo-yomi it is the main time plus every period still available: a move made
 * after the main time resets the current period, and a period overrun is gone for good (`byoyomiState` splits it back).
 */
export class Clock {
  readonly remaining: Record<Color, number>;
  readonly increment: number;
  /** Arena berserk: that side's time was halved and gets no increment. */
  readonly berserk: Record<Color, boolean>;
  /** Byo-yomi period in ms, and the periods each side starts with; 0 for a Fischer clock. */
  readonly #period: number;
  readonly #periods: number;
  running: Color | null = null;
  #since = 0;

  constructor(timeControl: TimeControl, remaining?: Record<Color, number>, berserk?: Readonly<Record<Color, boolean>>) {
    this.#period = isByoyomi(timeControl) ? timeControl.byoyomi * 1000 : 0;
    this.#periods = isByoyomi(timeControl) ? timeControl.periods : 0;
    const start = timeControl.initial * 1000 + this.#period * this.#periods;
    this.remaining = remaining ? { ...remaining } : { white: start, black: start };
    this.increment = timeControl.increment * 1000;
    this.berserk = { white: berserk?.white ?? false, black: berserk?.black ?? false };
  }

  /** Arena berserk: halves `color`'s time left and drops their increment for the rest of the game. */
  goBerserk(color: Color, now: number): void {
    const left = this.timeLeft(color, now);
    this.remaining[color] = Math.floor(left / 2);
    if (this.running === color) this.#since = now;
    this.berserk[color] = true;
  }

  timeLeft(color: Color, now: number): number {
    return Math.max(0, this.remaining[color] - (this.running === color ? now - this.#since : 0));
  }

  start(color: Color, now: number): void {
    this.running = color;
    this.#since = now;
  }

  /**
   * Ends `color`'s move: charges the elapsed time, adds the increment (or resets the byo-yomi period) and starts
   * `next`. During the draft `next` can be the same player, when the opponent has already declared done.
   */
  press(color: Color, next: Color, now: number): void {
    if (this.running !== color) return;
    const left = this.timeLeft(color, now);
    if (this.#period === 0) this.remaining[color] = left + (this.berserk[color] ? 0 : this.increment);
    else if (left <= this.#period * this.#periods) this.remaining[color] = Math.ceil(left / this.#period) * this.#period;
    else this.remaining[color] = left;
    this.start(next, now);
  }

  /** Extra time for `color`, also while their clock runs. Only for Fischer clocks: in byo-yomi it would count as periods. */
  add(color: Color, ms: number): void {
    if (this.#period === 0) this.remaining[color] += ms;
  }

  stop(now: number): void {
    if (this.running) this.remaining[this.running] = this.timeLeft(this.running, now);
    this.running = null;
  }

  view(now: number): ClockView {
    return { white: this.timeLeft('white', now), black: this.timeLeft('black', now), running: this.running };
  }
}

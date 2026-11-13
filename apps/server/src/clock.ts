import type { Color } from '@ligungi/engine';
import type { ClockView, TimeControl } from '@ligungi/protocol';

export class Clock {
  readonly remaining: Record<Color, number>;
  readonly increment: number;
  running: Color | null = null;
  #since = 0;

  constructor(timeControl: TimeControl, remaining?: Record<Color, number>) {
    this.remaining = remaining ? { ...remaining } : { white: timeControl.initial * 1000, black: timeControl.initial * 1000 };
    this.increment = timeControl.increment * 1000;
  }

  timeLeft(color: Color, now: number): number {
    return Math.max(0, this.remaining[color] - (this.running === color ? now - this.#since : 0));
  }

  start(color: Color, now: number): void {
    this.running = color;
    this.#since = now;
  }

  /**
   * Ends `color`'s move: charges the elapsed time, adds the increment and starts `next`. During the
   * draft `next` can be the same player, when the opponent has already declared done.
   */
  press(color: Color, next: Color, now: number): void {
    if (this.running !== color) return;
    this.remaining[color] = this.timeLeft(color, now) + this.increment;
    this.start(next, now);
  }

  /** Extra time for `color`, also while their clock runs. */
  add(color: Color, ms: number): void {
    this.remaining[color] += ms;
  }

  stop(now: number): void {
    if (this.running) this.remaining[this.running] = this.timeLeft(this.running, now);
    this.running = null;
  }

  view(now: number): ClockView {
    return { white: this.timeLeft('white', now), black: this.timeLeft('black', now), running: this.running };
  }
}

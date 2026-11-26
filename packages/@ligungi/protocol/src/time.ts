/**
 * Seconds. A Fischer clock adds `increment` after every move. A byo-yomi clock has no increment: once the main time
 * (`initial`, which may be 0) runs out, every move must be made within `byoyomi` seconds, and each period overrun uses
 * up one of the `periods`; the flag falls when none is left.
 */
export interface TimeControl {
  readonly initial: number;
  readonly increment: number;
  readonly byoyomi?: number;
  readonly periods?: number;
}

/** Seconds per move offered for byo-yomi, and how many periods a player may have. */
export const BYOYOMI_SECONDS: readonly number[] = [10, 20, 30, 60];
export const BYOYOMI_PERIODS_MAX = 3;

export const isByoyomi = (tc: TimeControl | null): tc is TimeControl & { readonly byoyomi: number; readonly periods: number } =>
  tc !== null && (tc.byoyomi ?? 0) > 0 && (tc.periods ?? 0) > 0;

/** A byo-yomi clock read from the time left until the flag falls: the main time, then the current period and how many are left. */
export interface ByoyomiState {
  readonly main: number;
  readonly period: number;
  readonly periods: number;
}

/**
 * Splits a byo-yomi clock's time until the flag falls (`ms`, as `ClockView` sends it) into what a clock shows. The
 * server keeps that single number: the main time plus every period left, with the current period reset after each move.
 */
export const byoyomiState = (ms: number, tc: TimeControl & { readonly byoyomi: number; readonly periods: number }): ByoyomiState => {
  const period = tc.byoyomi * 1000;
  const all = period * tc.periods;
  if (ms > all) return { main: ms - all, period, periods: tc.periods };
  const periods = Math.max(0, Math.ceil(ms / period));
  return { main: 0, period: Math.max(0, ms - Math.max(0, periods - 1) * period), periods };
};

export const TIME_PRESETS: readonly TimeControl[] = [
  { initial: 300, increment: 3 },
  { initial: 600, increment: 5 },
  { initial: 900, increment: 10 },
  { initial: 1800, increment: 0 },
  { initial: 1800, increment: 20 },
  { initial: 3600, increment: 30 },
];

/** Days per move offered for correspondence games. */
export const CORRESPONDENCE_DAYS: readonly number[] = [1, 3, 7, 14];

/** How long a correspondence challenge or seek waits for an answer, against two hours for other challenges. */
export const CORRESPONDENCE_WAIT_DAYS = 7;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** `10+5` for a Fischer clock; `10|30s`, or `10|3×30s` with several periods, for byo-yomi (lishogi's notation). */
export const formatTimeControl = (tc: TimeControl | null): string => {
  if (!tc) return '∞';
  const minutes = tc.initial % 60 === 0 ? String(tc.initial / 60) : (tc.initial / 60).toFixed(1);
  if (isByoyomi(tc)) return `${minutes}|${tc.periods > 1 ? `${tc.periods}×` : ''}${tc.byoyomi}s`;
  return `${minutes}+${tc.increment}`;
};

export const sameTimeControl = (a: TimeControl | null, b: TimeControl | null): boolean =>
  a === b ||
  (!!a && !!b && a.initial === b.initial && a.increment === b.increment && (a.byoyomi ?? 0) === (b.byoyomi ?? 0) && (a.periods ?? 0) === (b.periods ?? 0));

/** Seconds a player gives the opponent with the "extra time" button, as on lichess. */
export const EXTRA_TIME_SECONDS = 15;

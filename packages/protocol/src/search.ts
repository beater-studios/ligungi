import { MODES, type Color, type Mode, type Outcome } from '@ligungi/engine';
import type { ErrorCode } from './errors.ts';
import type { GameSummary } from './games.ts';

export const GAME_SEARCH_PAGE = 30;
/** Pages a search can go through: the oldest games are reached by narrowing the search, not by paging forever. */
export const GAME_SEARCH_PAGES_MAX = 50;
export const GAME_REASONS: readonly Outcome['reason'][] = ['mate', 'capture', 'resign', 'timeout', 'abandon', 'repetition', 'insufficient', 'agreement'];

/** The winning side, or, with a player, the result from that player's side. */
export type SearchResult = 'white' | 'black' | 'draw' | 'win' | 'loss';
const SEARCH_RESULTS: readonly SearchResult[] = ['white', 'black', 'draw', 'win', 'loss'];

/** Search over every finished game (`GET /api/games/search`); every field is optional. */
export interface GameSearch {
  /** A player of the game, either color. */
  readonly player?: string;
  /** The color `player` played. */
  readonly color?: Color;
  /** `player`'s opponent. */
  readonly vs?: string;
  readonly mode?: Mode;
  readonly rated?: boolean;
  readonly result?: SearchResult;
  readonly reason?: Outcome['reason'];
  /** Bounds of the average rating of both players, as it was when the game started; games with a player unrated are left out. */
  readonly ratingMin?: number;
  readonly ratingMax?: number;
  /** Days, `YYYY-MM-DD`, in UTC: the game started on or after `from` and on or before `to`. */
  readonly from?: string;
  readonly to?: string;
  /** Bounds of the number of moves, the draft's included. */
  readonly movesMin?: number;
  readonly movesMax?: number;
  /** From 1. */
  readonly page?: number;
}

export interface GameSearchResult {
  readonly games: readonly GameSummary[];
  readonly more: boolean;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const USERNAME = /^[A-Za-z0-9_-]{1,20}$/;

/** A day written as `YYYY-MM-DD`, at midnight UTC, or `null` when it is not a real day. */
export const dayStart = (day: string): number | null => {
  if (!DAY.test(day)) return null;
  const at = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== day ? null : at;
};

const whole = (value: string, min: number, max: number): number | null => {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};

/** Reads a search from a query string: empty fields are ignored, anything else that does not fit is `invalidSearch`. */
export const parseGameSearch = (params: URLSearchParams): GameSearch | ErrorCode => {
  const search: { -readonly [K in keyof GameSearch]: GameSearch[K] } = {};
  const text = (key: string) => params.get(key)?.trim() ?? '';
  const player = text('player');
  const vs = text('vs');
  if (player) {
    if (!USERNAME.test(player)) return 'invalidSearch';
    search.player = player;
  }
  if (vs) {
    if (!USERNAME.test(vs) || !player) return 'invalidSearch';
    search.vs = vs;
  }
  const color = text('color');
  if (color) {
    if ((color !== 'white' && color !== 'black') || !player) return 'invalidSearch';
    search.color = color;
  }
  const mode = text('mode');
  if (mode) {
    if (!(MODES as readonly string[]).includes(mode)) return 'invalidSearch';
    search.mode = mode as Mode;
  }
  const rated = text('rated');
  if (rated) {
    if (rated !== '1' && rated !== '0') return 'invalidSearch';
    search.rated = rated === '1';
  }
  const result = text('result');
  if (result) {
    if (!SEARCH_RESULTS.includes(result as SearchResult) || ((result === 'win' || result === 'loss') && !player)) return 'invalidSearch';
    search.result = result as SearchResult;
  }
  const reason = text('reason');
  if (reason) {
    if (!GAME_REASONS.includes(reason as Outcome['reason'])) return 'invalidSearch';
    search.reason = reason as Outcome['reason'];
  }
  for (const [key, min, max] of [
    ['ratingMin', 0, 4000],
    ['ratingMax', 0, 4000],
    ['movesMin', 0, 2000],
    ['movesMax', 0, 2000],
    ['page', 1, GAME_SEARCH_PAGES_MAX],
  ] as const) {
    const value = text(key);
    if (!value) continue;
    const n = whole(value, min, max);
    if (n === null) return 'invalidSearch';
    search[key] = n;
  }
  for (const key of ['from', 'to'] as const) {
    const value = text(key);
    if (!value) continue;
    if (dayStart(value) === null) return 'invalidSearch';
    search[key] = value;
  }
  return search;
};

/** Inverse of `parseGameSearch`, for links and requests. */
export const gameSearchQuery = (search: GameSearch): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search) as Array<[keyof GameSearch, GameSearch[keyof GameSearch]]>) {
    if (value === undefined || value === '') continue;
    params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  return params;
};

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

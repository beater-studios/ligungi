import type { Mode } from '@ligungi/engine';
import type { GameSummary } from './games.ts';
import type { TimeControl } from './time.ts';
import type { UserRef } from './users.ts';

/**
 * The weekly Arena: one tournament every Saturday at 18:00 UTC, in the Advanced mode at 5+3, for 90 minutes, rated. Players
 * join and leave at any time and are paired again as soon as they finish a game (as in lichess's Arena).
 */
export const ARENA = {
  mode: 'advanced' as Mode,
  timeControl: { initial: 300, increment: 3 } as TimeControl,
  durationMinutes: 90,
  /** Day of the week (0 = Sunday, UTC) and time (UTC) of the weekly start. */
  weekday: 6,
  hour: 18,
  minute: 0,
  /** Players needed at the start; with fewer, the Arena waits `startGraceMinutes` and is then canceled. */
  minPlayers: 4,
  startGraceMinutes: 10,
  /** No new pairings this close to the end: a 5+3 game with a draft rarely ends sooner, and games still running at the end do not count. */
  pairingCutoffMinutes: 8,
  /** Games a player needs for a trophy. */
  trophyMinGames: 3,
  /** A draw before this many moves of the play phase (the draft does not count) gives no points. */
  earlyDrawMoves: 10,
  /** When the joined players are reminded in the bell, and when the Discord channel hears of it. */
  reminderMinutes: 10,
  announceMinutes: 60,
  /** The first weekly Arena, announced ahead: none is scheduled before it. */
  firstStart: Date.UTC(2026, 11, 5, 18, 0),
} as const;

export const ARENA_STATUSES = ['created', 'started', 'finished', 'canceled'] as const;
export type ArenaStatus = (typeof ARENA_STATUSES)[number];

/** A trophy's kind; the tower of discs gets lower with the place (3 discs for the champion, 1 for third). */
export const TROPHY_KINDS = ['arenaChampion', 'arenaSecond', 'arenaThird', 'arenaTop'] as const;
export type TrophyKind = (typeof TROPHY_KINDS)[number];

/** Which trophies an Arena gives, from the players with at least one game counted: 4 for a champion, 8 for the podium, 16 for the top 10%. */
export const arenaPrizes = (players: number): { readonly champion: boolean; readonly podium: boolean; readonly top: boolean } => ({
  champion: players >= ARENA.minPlayers,
  podium: players >= 8,
  top: players >= 16,
});

/** How many of the first places count as the top 10%. */
export const arenaTopCount = (players: number): number => Math.ceil(players * 0.1);

const DAY_MS = 24 * 60 * 60 * 1000;

/** The first weekly start strictly after `after` (epoch ms), never before `ARENA.firstStart`. */
export const nextArenaStart = (after: number): number => {
  if (after < ARENA.firstStart) return ARENA.firstStart;
  const date = new Date(after);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), ARENA.hour, ARENA.minute);
  const days = (ARENA.weekday - date.getUTCDay() + 7) % 7;
  let at = start + days * DAY_MS;
  if (at <= after) at += 7 * DAY_MS;
  return at;
};

/** Season 0 is everything before 2027; then one season per quarter, `2027-Q1` and so on. */
export const arenaSeason = (at: number): string => {
  const date = new Date(at);
  const year = date.getUTCFullYear();
  if (year < 2027) return 'S0';
  return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
};

/** A player's run inside an Arena, enough to score the next game. */
export interface ArenaStreak {
  /** Wins in a row; from 2, the next win is worth double. */
  readonly wins: number;
  /** The last game was a draw: a second draw in a row gives no point. */
  readonly drew: boolean;
}

export const ARENA_START_STREAK: ArenaStreak = { wins: 0, drew: false };

/**
 * Points for one game, as on lichess: a win 2 (4 on a streak of two or more wins), a draw 1, a loss 0. A draw early in
 * the play phase, or right after another draw, gives nothing; a draw or a loss ends the streak.
 */
export const arenaPoints = (
  result: 'win' | 'draw' | 'loss',
  streak: ArenaStreak,
  boardMoves: number,
): { readonly points: number; readonly doubled: boolean; readonly streak: ArenaStreak } => {
  if (result === 'win') {
    const doubled = streak.wins >= 2;
    return { points: doubled ? 4 : 2, doubled, streak: { wins: streak.wins + 1, drew: false } };
  }
  if (result === 'draw') {
    const early = boardMoves < ARENA.earlyDrawMoves * 2;
    return { points: early || streak.drew ? 0 : 1, doubled: false, streak: { wins: 0, drew: true } };
  }
  return { points: 0, doubled: false, streak: ARENA_START_STREAK };
};

/** A performance rating, the linear approximation FIDE uses: the opponents' average, 400 up per win and down per loss beyond the even score. */
export const arenaPerformance = (opponents: readonly number[], wins: number, losses: number): number | null =>
  opponents.length === 0 ? null : Math.round(opponents.reduce((sum, rating) => sum + rating, 0) / opponents.length + (400 * (wins - losses)) / opponents.length);

/** One game on a player's sheet: its points and whether they were doubled by a streak. */
export interface ArenaSheetEntry {
  readonly points: number;
  readonly doubled: boolean;
}

/** `playing`: in an Arena game now; `waiting`: on the Arena page, to be paired; `away`: paused or off the page. */
export type ArenaPlayerState = 'playing' | 'waiting' | 'away';

export interface ArenaStanding {
  readonly rank: number;
  readonly user: UserRef;
  readonly rating: number;
  readonly provisional: boolean;
  readonly score: number;
  readonly games: number;
  readonly wins: number;
  readonly performance: number | null;
  /** On a streak: the next win is worth double. */
  readonly fire: boolean;
  readonly sheet: readonly ArenaSheetEntry[];
  /** While the Arena runs; `null` before and after. */
  readonly state: ArenaPlayerState | null;
  /** Once finished: the trophy this place earned, if any. */
  readonly trophy: TrophyKind | null;
}

export interface ArenaView {
  readonly id: string;
  readonly status: ArenaStatus;
  readonly mode: Mode;
  readonly timeControl: TimeControl;
  readonly rated: boolean;
  readonly durationMinutes: number;
  readonly minPlayers: number;
  /** Planned start; the Arena may start up to `ARENA.startGraceMinutes` later when players are missing. */
  readonly startsAt: number;
  readonly startedAt: number | null;
  /** When it ends (or ended), once started. */
  readonly endsAt: number | null;
  readonly finishedAt: number | null;
  readonly season: string;
  /** Players with at least one game counted; what the trophies scale with. */
  readonly players: number;
  readonly standings: readonly ArenaStanding[];
  /** Arena games being played, strongest first. */
  readonly games: readonly GameSummary[];
  /** The viewer, when signed in. */
  readonly you: { readonly joined: boolean; readonly paused: boolean; readonly game: string | null } | null;
}

export interface ArenaSummary {
  readonly id: string;
  readonly status: ArenaStatus;
  readonly startsAt: number;
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
  readonly players: number;
  readonly joined: number;
  readonly winner: UserRef | null;
}

/** `GET /api/arena`: the Arena running or the next one, and the latest finished or canceled ones. */
export interface ArenaList {
  readonly current: ArenaView | null;
  readonly recent: readonly ArenaSummary[];
}

export interface TrophyView {
  readonly kind: TrophyKind;
  readonly arena: string;
  readonly place: number;
  readonly players: number;
  readonly season: string;
  readonly at: number;
}

/** One Arena on a player's history. */
export interface ArenaResult {
  readonly arena: string;
  readonly at: number;
  readonly rank: number;
  readonly players: number;
  readonly games: number;
  readonly score: number;
}

/** `GET /api/users/:name/arenas`: a player's trophies and Arena history, for the profile. */
export interface PlayerArenas {
  readonly counts: { readonly champion: number; readonly podium: number; readonly top: number; readonly arenas: number };
  /** The latest trophies, newest first. */
  readonly trophies: readonly TrophyView[];
  /** The latest Arenas played, newest first. */
  readonly history: readonly ArenaResult[];
}

/** How many trophies and Arenas the profile lists. */
export const PROFILE_TROPHIES = 8;
export const PROFILE_ARENAS = 10;
/** How many finished Arenas `GET /api/arena` lists. */
export const ARENA_RECENT = 10;

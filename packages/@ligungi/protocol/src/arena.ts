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
  /** A berserk win needs this many moves of the play phase for its extra point, as on lichess. */
  berserkMinMoves: 7,
  /** The first weekly Arena, announced ahead: none is scheduled before it. */
  firstStart: Date.UTC(2026, 11, 5, 18, 0),
} as const;

export const ARENA_STATUSES = ['created', 'started', 'finished', 'canceled'] as const;
export type ArenaStatus = (typeof ARENA_STATUSES)[number];

/** A trophy's kind; the tower of discs gets lower with the place (3 discs for the champion, 1 for third). */
export const TROPHY_KINDS = ['arenaChampion', 'arenaSecond', 'arenaThird', 'arenaTop', 'seasonChampion'] as const;
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

const SEASON_ID = /^(S0|(\d{4})-Q([1-4]))$/;

export const isSeason = (value: string): boolean => SEASON_ID.test(value);

/** When a season starts and ends (epoch ms, end excluded). Season 0 runs until 2027. */
export const seasonRange = (season: string): { readonly from: number; readonly to: number } => {
  const match = SEASON_ID.exec(season);
  if (!match || match[1] === 'S0') return { from: ARENA.firstStart, to: Date.UTC(2027, 0, 1) };
  const year = Number(match[2]);
  const quarter = Number(match[3]);
  return { from: Date.UTC(year, (quarter - 1) * 3, 1), to: Date.UTC(year, quarter * 3, 1) };
};

/** How many of a player's best Arenas count for the season: half of those played in it, rounded up. */
export const seasonCounted = (arenas: number): number => Math.ceil(arenas / 2);

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
  berserk = false,
): { readonly points: number; readonly doubled: boolean; readonly berserk: boolean; readonly streak: ArenaStreak } => {
  if (result === 'win') {
    const doubled = streak.wins >= 2;
    // A berserk win earns one more point once the game lasted long enough, so berserk and a quick abandon earn nothing extra.
    const bonus = berserk && boardMoves >= ARENA.berserkMinMoves * 2;
    return { points: (doubled ? 4 : 2) + (bonus ? 1 : 0), doubled, berserk: bonus, streak: { wins: streak.wins + 1, drew: false } };
  }
  if (result === 'draw') {
    const early = boardMoves < ARENA.earlyDrawMoves * 2;
    return { points: early || streak.drew ? 0 : 1, doubled: false, berserk: false, streak: { wins: 0, drew: true } };
  }
  return { points: 0, doubled: false, berserk: false, streak: ARENA_START_STREAK };
};

/** A performance rating, the linear approximation FIDE uses: the opponents' average, 400 up per win and down per loss beyond the even score. */
export const arenaPerformance = (opponents: readonly number[], wins: number, losses: number): number | null =>
  opponents.length === 0 ? null : Math.round(opponents.reduce((sum, rating) => sum + rating, 0) / opponents.length + (400 * (wins - losses)) / opponents.length);

/** One game on a player's sheet: its points, whether they were doubled by a streak and whether berserk added one. */
export interface ArenaSheetEntry {
  readonly points: number;
  readonly doubled: boolean;
  readonly berserk: boolean;
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

/** One player in a season's standings: the sum of their best Arenas (`counted` of them). */
export interface SeasonStanding {
  readonly rank: number;
  readonly user: UserRef;
  readonly points: number;
  readonly arenas: number;
  /** One entry per finished Arena of the season, in order: the score, `null` when not played, and whether it counts. */
  readonly results: readonly { readonly score: number | null; readonly counted: boolean }[];
  readonly champion: boolean;
}

/** `GET /api/arena/season/:id`: a season's standings. */
export interface SeasonView {
  readonly season: string;
  readonly from: number;
  readonly to: number;
  /** The season is over (its champion, if any, has the trophy). */
  readonly over: boolean;
  /** Finished Arenas of the season, in order. */
  readonly arenas: readonly { readonly id: string; readonly startsAt: number }[];
  /** Arenas still to come in the season. */
  readonly upcoming: readonly { readonly id: string; readonly startsAt: number }[];
  /** How many of each player's best Arenas count. */
  readonly counted: number;
  readonly standings: readonly SeasonStanding[];
}

/** A player's place in one season, for the profile. */
export interface PlayerSeason {
  readonly season: string;
  readonly rank: number;
  readonly players: number;
  readonly points: number;
  readonly arenas: number;
  readonly over: boolean;
}

/** `GET /api/users/:name/arenas`: a player's trophies and Arena history, for the profile. */
export interface PlayerArenas {
  readonly counts: { readonly champion: number; readonly podium: number; readonly top: number; readonly arenas: number; readonly seasons: number };
  /** The seasons the player played, newest first. */
  readonly seasons: readonly PlayerSeason[];
  /** The latest trophies, newest first. */
  readonly trophies: readonly TrophyView[];
  /** The latest Arenas played, newest first. */
  readonly history: readonly ArenaResult[];
}

/** How many trophies and Arenas the profile lists. */
export const PROFILE_TROPHIES = 40;
export const PROFILE_ARENAS = 10;
/** How many finished Arenas `GET /api/arena` lists. */
export const ARENA_RECENT = 10;

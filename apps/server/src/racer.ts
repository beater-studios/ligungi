import { isForcedMate, longestDefense } from '@ligungi/bot';
import { applyMove, isMarshalAttacked, legalMoves, moveToString, opposite, parseFen, parseMove, type Position } from '@ligungi/engine';
import {
  PUZZLE_RUN_RECENT_MS,
  RACE_COUNTDOWN_MS,
  RACE_MAX_GHOSTS,
  RACE_MAX_PLAYERS,
  RACE_PUBLIC_WAIT_MS,
  RACE_TIME_MS,
  racerBonus,
  type ErrorCode,
  type RaceGhostView,
  type RaceKind,
  type RaceStatus,
  type RaceView,
  type RacerRecordsView,
  type RacerRef,
} from '@ligungi/protocol';
import type { Db } from './db.ts';
import type { Player } from './games.ts';
import { randomId } from './ids.ts';
import { isPuzzle, puzzleEntry } from './puzzles.ts';

/** A private race nobody starts is dropped after this long, and a finished one is kept this long for its results. */
const WAITING_TTL_MS = 30 * 60_000;
const FINISHED_TTL_MS = 10 * 60_000;
/** Moves sent just before the end still count if they arrive within this margin. */
const LATE_MS = 1_000;
/** How often a public race reuses the puzzles of an earlier one, which brings its players back as ghosts. */
const REUSE_CHANCE = 0.7;
/** Earlier public races considered for reuse, newest first. */
const REUSE_POOL = 50;
/** A reused race must still have this many of its puzzles (puzzles can be removed from the collection). */
const REUSE_MIN_PUZZLES = 40;

interface Racer {
  readonly player: Player;
  readonly guest: number | null;
  index: number;
  position: Position | null;
  /** Moves played in the current puzzle, the opponent's replies included. */
  played: number;
  /** Still on the stored solution line (a mate can leave it for another mating move). */
  onLine: boolean;
  score: number;
  combo: number;
  skipUsed: boolean;
  /** `[ms from the start, score]` after each change of score, to replay the race as a ghost later. */
  readonly points: Array<[number, number]>;
}

interface Race {
  readonly id: string;
  readonly kind: RaceKind;
  readonly instanceId: string | null;
  readonly owner: string;
  readonly setId: string;
  /** Whether the puzzle set is already saved (a public race reusing an earlier set). */
  readonly savedSet: boolean;
  readonly puzzles: readonly string[];
  readonly racers: Racer[];
  readonly ghosts: readonly RaceGhostView[];
  status: RaceStatus;
  readonly createdAt: number;
  startsAt: number | null;
  endsAt: number | null;
  finishedAt: number | null;
}

export interface RacerOptions {
  readonly now: () => number;
  readonly random: () => number;
  /** Draws the puzzles of a new race. */
  readonly sequence: () => string[];
  /** Called after any change, to send the race to whoever follows it. */
  readonly onChange: (raceId: string) => void;
  /** Runs `fn` after `ms`; tests replace it. */
  readonly schedule?: (fn: () => void, ms: number) => void;
}

const samePlayer = (a: Player, b: Player) => a.sessionId === b.sessionId || (a.userId !== null && a.userId === b.userId);

/**
 * Puzzle Racer races, in memory: their players, the moves they play and the score, checked here against each puzzle's
 * solution (as the puzzle page does: the stored line, or in mates any other move that still forces mate). Finished races
 * keep each player's result, which makes the records and brings players back as ghosts when a public race reuses the
 * same puzzles.
 */
export class Racers {
  readonly #races = new Map<string, Race>();
  readonly #db: Db;
  readonly #options: RacerOptions;
  readonly #schedule: (fn: () => void, ms: number) => void;
  #publicId: string | null = null;
  readonly #callRaces = new Map<string, string>();

  constructor(db: Db, options: RacerOptions) {
    this.#db = db;
    this.#options = options;
    this.#schedule =
      options.schedule ??
      ((fn, ms) => {
        const timer = setTimeout(fn, ms);
        timer.unref?.();
      });
  }

  #now(): number {
    return this.#options.now();
  }

  /** Moves races along their clock: starts, ends and forgets them. Called on every access and by the timers. */
  tick(): void {
    const now = this.#now();
    for (const race of this.#races.values()) {
      if (race.status === 'countdown' && race.startsAt !== null && now >= race.startsAt) {
        race.status = 'racing';
        if (this.#publicId === race.id) this.#publicId = null;
        this.#options.onChange(race.id);
      }
      if (race.status === 'racing' && race.endsAt !== null && now >= race.endsAt + LATE_MS) this.#finish(race);
      const expired =
        (race.status === 'waiting' && now - race.createdAt > WAITING_TTL_MS) ||
        (race.status === 'finished' && race.finishedAt !== null && now - race.finishedAt > FINISHED_TTL_MS);
      if (expired) {
        this.#races.delete(race.id);
        if (this.#publicId === race.id) this.#publicId = null;
        if (race.instanceId && this.#callRaces.get(race.instanceId) === race.id) this.#callRaces.delete(race.instanceId);
      }
    }
  }

  #at(race: Race, when: number): void {
    this.#schedule(() => this.tick(), Math.max(0, when - this.#now()));
  }

  #setStart(race: Race, startsAt: number): void {
    race.status = 'countdown';
    race.startsAt = startsAt;
    race.endsAt = startsAt + RACE_TIME_MS;
    this.#at(race, startsAt);
    this.#at(race, race.endsAt + LATE_MS);
  }

  #racer(player: Player): Racer {
    return {
      player,
      guest: player.userId ? null : 1000 + Math.floor(this.#options.random() * 9000),
      index: 0,
      position: null,
      played: 0,
      onLine: true,
      score: 0,
      combo: 0,
      skipUsed: false,
      points: [],
    };
  }

  #create(kind: RaceKind, owner: Player, instanceId: string | null, set: { id: string; puzzles: string[]; ghosts: RaceGhostView[] } | null): Race {
    const race: Race = {
      id: randomId(8),
      kind,
      instanceId,
      owner: owner.sessionId,
      setId: set?.id ?? randomId(10),
      savedSet: set !== null,
      puzzles: set?.puzzles ?? this.#options.sequence(),
      racers: [this.#racer(owner)],
      ghosts: set?.ghosts ?? [],
      status: 'waiting',
      createdAt: this.#now(),
      startsAt: null,
      endsAt: null,
      finishedAt: null,
    };
    this.#races.set(race.id, race);
    this.#at(race, race.createdAt + WAITING_TTL_MS + 1);
    return race;
  }

  /** Joins the open public race, or opens one, which starts a little after its first player joins. */
  joinPublic(player: Player): string {
    this.tick();
    const open = this.#publicId ? this.#races.get(this.#publicId) : undefined;
    if (open && open.status === 'countdown') {
      if (!open.racers.some((racer) => samePlayer(racer.player, player))) {
        open.racers.push(this.#racer(player));
        // A full race does not wait for more.
        if (open.racers.length >= RACE_MAX_PLAYERS) {
          this.#setStart(open, Math.min(open.startsAt!, this.#now() + RACE_COUNTDOWN_MS));
          this.#publicId = null;
        }
        this.#options.onChange(open.id);
      }
      return open.id;
    }
    const race = this.#create('public', player, null, this.#reusedSet(player));
    this.#setStart(race, this.#now() + RACE_PUBLIC_WAIT_MS);
    this.#publicId = race.id;
    return race.id;
  }

  /** A private race, joined through its link or, for `call`, by the people of a Discord Activity call. */
  create(player: Player, kind: 'friends' | 'call', instanceId: string | null = null): string {
    this.tick();
    const race = this.#create(kind, player, instanceId, null);
    if (instanceId) this.#callRaces.set(instanceId, race.id);
    return race.id;
  }

  /** The call's race that can still be joined, if any. */
  callRace(instanceId: string): { id: string; status: RaceStatus; players: number } | null {
    this.tick();
    const id = this.#callRaces.get(instanceId);
    const race = id ? this.#races.get(id) : undefined;
    if (!race || race.status === 'finished') return null;
    return { id: race.id, status: race.status, players: race.racers.length };
  }

  join(raceId: string, player: Player, instanceId: string | null = null): ErrorCode | null {
    this.tick();
    const race = this.#races.get(raceId);
    if (!race) return 'raceNotFound';
    if (race.instanceId !== null && race.instanceId !== instanceId) return 'notInActivity';
    if (race.racers.some((racer) => samePlayer(racer.player, player))) return null;
    if (race.status === 'racing' || race.status === 'finished') return 'raceStarted';
    if (race.racers.length >= RACE_MAX_PLAYERS) return 'raceFull';
    race.racers.push(this.#racer(player));
    this.#options.onChange(race.id);
    return null;
  }

  start(raceId: string, player: Player): ErrorCode | null {
    this.tick();
    const race = this.#races.get(raceId);
    if (!race) return 'raceNotFound';
    if (race.status !== 'waiting') return race.status === 'countdown' ? null : 'raceStarted';
    if (race.owner !== player.sessionId) return 'notRaceOwner';
    this.#setStart(race, this.#now() + RACE_COUNTDOWN_MS);
    this.#options.onChange(race.id);
    return null;
  }

  #live(raceId: string, player: Player, puzzle: number): { race: Race; racer: Racer } | null {
    this.tick();
    const race = this.#races.get(raceId);
    if (!race || race.status !== 'racing' || race.endsAt === null) return null;
    if (this.#now() > race.endsAt + LATE_MS) return null;
    const racer = race.racers.find((candidate) => samePlayer(candidate.player, player));
    if (!racer || racer.index !== puzzle || racer.index >= race.puzzles.length) return null;
    if (!racer.position) racer.position = parseFen(puzzleEntry(race.puzzles[racer.index]!)!.puzzle.fen);
    return { race, racer };
  }

  #next(race: Race, racer: Racer): void {
    racer.index++;
    racer.played = 0;
    racer.onLine = true;
    const entry = racer.index < race.puzzles.length ? puzzleEntry(race.puzzles[racer.index]!) : undefined;
    racer.position = entry ? parseFen(entry.puzzle.fen) : null;
  }

  #score(race: Race, racer: Racer, points: number): void {
    racer.score += points;
    racer.points.push([Math.min(RACE_TIME_MS, this.#now() - race.startsAt!), racer.score]);
  }

  /** A move on the racer's current puzzle. Returns whether it was right; `null` when it does not apply (late, stale). */
  move(raceId: string, player: Player, puzzle: number, text: string): boolean | null {
    const live = this.#live(raceId, player, puzzle);
    if (!live) return null;
    const { race, racer } = live;
    const position = racer.position!;
    const move = legalMoves(position).find((candidate) => moveToString(candidate) === text);
    if (!move) return null;
    const { puzzle: stored, info } = puzzleEntry(race.puzzles[racer.index]!)!;
    const left = info.moves - Math.floor(racer.played / 2);
    const after = applyMove(position, move);
    let reply: string | null = null;
    let right = false;
    if (racer.onLine && stored.line[racer.played] === text) {
      right = true;
      reply = stored.line[racer.played + 1] ?? null;
    } else if (info.kind === 'mate' && isMarshalAttacked(after, opposite(position.turn)) && isForcedMate(after, left - 1)) {
      right = true;
      racer.onLine = false;
      const defense = left > 1 ? longestDefense(after, left - 1) : null;
      reply = defense ? moveToString(defense) : null;
    }
    if (!right) {
      racer.combo = 0;
      this.#next(race, racer);
    } else {
      racer.combo++;
      this.#score(race, racer, 1 + racerBonus(racer.combo));
      const answer = reply ? parseMove(reply) : undefined;
      if (left === 1 || !answer) this.#next(race, racer);
      else {
        racer.position = applyMove(after, answer);
        racer.played += 2;
      }
    }
    this.#options.onChange(race.id);
    return right;
  }

  /** Gives up the current puzzle, once per race, keeping the combo. */
  skip(raceId: string, player: Player, puzzle: number): boolean {
    const live = this.#live(raceId, player, puzzle);
    if (!live || live.racer.skipUsed) return false;
    live.racer.skipUsed = true;
    this.#next(live.race, live.racer);
    this.#options.onChange(live.race.id);
    return true;
  }

  #ref(racer: { player: Player; guest: number | null }): RacerRef {
    const { player, guest } = racer;
    return { name: player.userId ? player.name : '', user: player.userId ? { id: player.userId, name: player.name } : null, guest };
  }

  view(raceId: string, viewer: Player): RaceView | null {
    this.tick();
    const race = this.#races.get(raceId);
    if (!race) return null;
    const now = this.#now();
    const mine = race.racers.find((racer) => samePlayer(racer.player, viewer));
    return {
      id: race.id,
      kind: race.kind,
      status: race.status,
      owner: race.owner === viewer.sessionId,
      startsIn: race.startsAt === null ? null : race.startsAt - now,
      endsIn: race.endsAt === null ? null : race.endsAt - now,
      puzzles: race.status === 'waiting' ? null : race.puzzles,
      players: race.racers.map((racer) => ({ ...this.#ref(racer), score: racer.score, me: racer === mine })),
      // A later player of a public race may have raced its puzzles before: never against their own ghost.
      ghosts: viewer.userId ? race.ghosts.filter((ghost) => ghost.user?.id !== viewer.userId) : race.ghosts,
      you: mine ? { index: mine.index, score: mine.score, combo: mine.combo, skipUsed: mine.skipUsed } : null,
    };
  }

  /** Players waiting in the open public race. */
  waiting(): number {
    this.tick();
    const open = this.#publicId ? this.#races.get(this.#publicId) : undefined;
    return open?.racers.length ?? 0;
  }

  /** The set of an earlier public race the player has not raced, with some of its players as ghosts; sometimes none. */
  #reusedSet(player: Player): { id: string; puzzles: string[]; ghosts: RaceGhostView[] } | null {
    if (this.#options.random() >= REUSE_CHANCE) return null;
    const userId = player.userId;
    const sets = this.#db
      .prepare(
        `select id, puzzles from race_sets s where public = 1
           and exists (select 1 from race_results r where r.set_id = s.id and (r.user_id is null or r.user_id is not ?))
           and (? is null or not exists (select 1 from race_results r where r.set_id = s.id and r.user_id = ?))
         order by created_at desc limit ?`,
      )
      .all(userId, userId, userId, REUSE_POOL) as Array<{ id: string; puzzles: string }>;
    if (sets.length === 0) return null;
    const set = sets[Math.floor(this.#options.random() * sets.length)]!;
    const puzzles = (JSON.parse(set.puzzles) as string[]).filter(isPuzzle);
    if (puzzles.length < REUSE_MIN_PUZZLES) return null;
    const results = this.#db
      .prepare(
        `select r.user_id as userId, u.username as name, r.guest as guest, r.points as points from race_results r
           left join users u on u.id = r.user_id where r.set_id = ? and (r.user_id is null or r.user_id is not ?)`,
      )
      .all(set.id, userId) as Array<{ userId: string | null; name: string | null; guest: number | null; points: string }>;
    const pool = results.map((row) => ({ row, tie: this.#options.random() })).sort((a, b) => a.tie - b.tie);
    const ghosts = pool.slice(0, RACE_MAX_GHOSTS).map(({ row }): RaceGhostView => ({
      name: row.userId && row.name ? row.name : '',
      user: row.userId && row.name ? { id: row.userId, name: row.name } : null,
      guest: row.userId && row.name ? null : (row.guest ?? 0),
      points: JSON.parse(row.points) as Array<[number, number]>,
    }));
    return { id: set.id, puzzles, ghosts };
  }

  #finish(race: Race): void {
    race.status = 'finished';
    race.finishedAt = this.#now();
    const at = race.finishedAt;
    // The race ends for everyone even if its results cannot be kept: this runs from a timer, where an error would stop the server.
    try {
      this.#save(race, at);
    } catch (error) {
      console.error(error);
    }
    this.#at(race, at + FINISHED_TTL_MS + 1);
    this.#options.onChange(race.id);
  }

  #save(race: Race, at: number): void {
    const insertResult = this.#db.prepare('insert into race_results (set_id, user_id, guest, score, points, created_at) values (?, ?, ?, ?, ?, ?)');
    this.#db.exec('begin');
    try {
      if (!race.savedSet) {
        this.#db.prepare('insert into race_sets (id, puzzles, public, created_at) values (?, ?, ?, ?)').run(race.setId, JSON.stringify(race.puzzles), race.kind === 'public' ? 1 : 0, at);
      }
      // A racer who never scored is not kept: no record to beat, and nothing to show as a ghost.
      for (const racer of race.racers) {
        if (racer.score === 0) continue;
        insertResult.run(race.setId, racer.player.userId, racer.guest, racer.score, JSON.stringify(racer.points), at);
      }
      this.#db.exec('commit');
    } catch (error) {
      this.#db.exec('rollback');
      throw error;
    }
  }

  /** The player's race scores of the last days and best ever. */
  records(userId: string): RacerRecordsView {
    const recent = this.#db
      .prepare('select score, created_at as at from race_results where user_id = ? and created_at >= ? order by created_at')
      .all(userId, this.#now() - PUZZLE_RUN_RECENT_MS) as Array<{ score: number; at: number }>;
    const best = this.#db.prepare('select max(score) as best from race_results where user_id = ?').get(userId) as { best: number | null };
    return { recent: recent.map(({ score, at }) => ({ score, at })), best: best.best ?? 0 };
  }

  /** Every race of the player, oldest first, for the data export. */
  allResults(userId: string): Array<{ score: number; at: number }> {
    return (this.#db.prepare('select score, created_at as at from race_results where user_id = ? order by created_at').all(userId) as Array<{ score: number; at: number }>).map(
      ({ score, at }) => ({ score, at }),
    );
  }
}

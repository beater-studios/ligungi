import type { Color, Mode } from '@ligungi/engine';
import {
  ARENA,
  ARENA_RECENT,
  PROFILE_ARENAS,
  PROFILE_TROPHIES,
  TROPHY_KINDS,
  arenaPerformance,
  arenaPoints,
  arenaPrizes,
  arenaSeason,
  arenaTopCount,
  nextArenaStart,
  type ArenaList,
  type ArenaSheetEntry,
  type ArenaStanding,
  type ArenaStatus,
  type ArenaSummary,
  type ArenaView,
  type ErrorCode,
  type NoticeKind,
  type PlayerArenas,
  type TrophyKind,
  type TrophyView,
  type UserRef,
} from '@ligungi/protocol';
import type { Db } from './db.ts';
import type { Games } from './games.ts';
import { PROVISIONAL_DEVIATION } from './glicko.ts';
import { randomId } from './ids.ts';
import { PERMANENT_SUSPENSION } from './moderation.ts';
import type { NoticeDetails } from './notices.ts';
import type { GameRoom } from './room.ts';
import type { Users } from './users.ts';

/** A player who just finished a game gets this long to see the result before the next pairing. */
const REST_MS = 8_000;
const MINUTE = 60_000;

interface ArenaRow {
  id: string;
  status: ArenaStatus;
  mode: Mode;
  clock_initial: number;
  clock_increment: number;
  duration: number;
  min_players: number;
  starts_at: number;
  started_at: number | null;
  finished_at: number | null;
  season: string;
  announced: number;
  reminded: number;
  created_at: number;
}

interface PlayerRow {
  user_id: string;
  username: string;
  rating: number;
  score: number;
  games: number;
  wins: number;
  losses: number;
  streak: number;
  drew: number;
  paused: number;
  rank: number | null;
  scored_at: number;
  joined_at: number;
}

interface PairingRow {
  game_id: string;
  arena_id: string;
  white_user: string | null;
  black_user: string | null;
  white_rating: number;
  black_rating: number;
  status: 'started' | 'ended' | 'aborted';
  winner: Color | null;
  white_points: number | null;
  black_points: number | null;
  white_doubled: number;
  black_doubled: number;
  counted: number;
  created_at: number;
  ended_at: number | null;
}

/** What the Discord channel hears about: the reminder before, the start, the result and a cancellation. */
export type ArenaEvent =
  | { readonly kind: 'soon'; readonly arena: string; readonly startsAt: number; readonly joined: number }
  | { readonly kind: 'started'; readonly arena: string; readonly joined: number }
  | {
      readonly kind: 'finished';
      readonly arena: string;
      readonly players: number;
      readonly podium: readonly { readonly user: UserRef; readonly rank: number; readonly score: number }[];
      readonly champion: UserRef | null;
      readonly previousChampion: string | null;
      readonly next: number | null;
    }
  | { readonly kind: 'canceled'; readonly arena: string; readonly joined: number; readonly next: number | null };

export interface ArenasOptions {
  readonly now: () => number;
  readonly random: () => number;
  /** Turns the weekly schedule off: no Arena is created on its own (tests create theirs). */
  readonly schedule: boolean;
  /**
   * Where a player has the Arena page, or their last Arena game, open: the session to seat them with, or `null` when
   * they are away (only players on the page are paired).
   */
  readonly presence: (arena: string, userId: string, lastGame: string | null) => string | null;
  /** Whether a player is busy in a live game outside the Arena. */
  readonly busy: (userId: string) => boolean;
  readonly changed: (arena: string) => void;
  readonly gameStarted: (room: GameRoom) => void;
  readonly notice: (userId: string, kind: NoticeKind, details: NoticeDetails) => void;
  readonly announce: (event: ArenaEvent) => void;
}

export interface PairingCandidate {
  readonly id: string;
  readonly score: number;
  readonly rating: number;
  readonly lastOpponent: string | null;
  /** Games with White minus games with Black, to balance the colors. */
  readonly colorBalance: number;
  /** Since when the player has been free (their last game's end, or when the Arena started for them). */
  readonly freeSince: number;
}

/**
 * Pairs the free players: the best placed first, each with the nearest player in the standings that is not the one
 * they just played (falling back to the nearest when no other is free). With an odd number, the one who has been free
 * the shortest time waits for the next round, so nobody is left out round after round.
 */
export const pairCandidates = (candidates: readonly PairingCandidate[], random: () => number): Array<{ readonly white: string; readonly black: string }> => {
  let pool = [...candidates].sort((a, b) => b.score - a.score || b.rating - a.rating || a.id.localeCompare(b.id));
  if (pool.length % 2 === 1) {
    const latest = pool.reduce((last, c) => (c.freeSince > last.freeSince ? c : last));
    pool = pool.filter((c) => c !== latest);
  }
  const pairs: Array<{ white: string; black: string }> = [];
  while (pool.length >= 2) {
    const first = pool.shift()!;
    let index = pool.findIndex((other) => other.id !== first.lastOpponent && other.lastOpponent !== first.id);
    if (index < 0) index = 0;
    const second = pool.splice(index, 1)[0]!;
    const firstWhite = first.colorBalance < second.colorBalance || (first.colorBalance === second.colorBalance && random() < 0.5);
    pairs.push(firstWhite ? { white: first.id, black: second.id } : { white: second.id, black: first.id });
  }
  return pairs;
};

/** Accounts suspended for good are left out of standings and trophies, as on the leaderboards. */
const NOT_BANNED = `(users.suspended_until is null or users.suspended_until < ${PERMANENT_SUSPENSION})`;

export class Arenas {
  readonly #db: Db;
  readonly #games: Games;
  readonly #users: Users;
  readonly #options: ArenasOptions;

  constructor(db: Db, games: Games, users: Users, options: ArenasOptions) {
    this.#db = db;
    this.#games = games;
    this.#users = users;
    this.#options = options;
  }

  /** Creates an Arena (the weekly one, or one for tests and local runs with its own start and length). */
  create(startsAt: number, durationMinutes: number = ARENA.durationMinutes): string {
    let id = randomId(8);
    while (this.#row(id)) id = randomId(8);
    this.#db
      .prepare(
        `insert into arenas (id, status, mode, clock_initial, clock_increment, duration, min_players, starts_at, season, created_at)
         values (?, 'created', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, ARENA.mode, ARENA.timeControl.initial, ARENA.timeControl.increment, durationMinutes, ARENA.minPlayers, startsAt, arenaSeason(startsAt), this.#options.now());
    return id;
  }

  /** Runs the schedule: creates the next Arena, reminds, starts, pairs, finishes or cancels. Called every few seconds. */
  tick(): void {
    const now = this.#options.now();
    if (this.#options.schedule) this.#ensureUpcoming(now);
    const rows = this.#db.prepare(`select * from arenas where status in ('created', 'started') order by starts_at`).all() as unknown as ArenaRow[];
    for (const row of rows) {
      if (row.status === 'created') this.#beforeStart(row, now);
      else if (now >= this.#endsAt(row)) this.#finish(row, now);
      else this.#pair(row, now);
    }
  }

  join(arenaId: string, userId: string): ErrorCode | null {
    const row = this.#row(arenaId);
    if (!row) return 'arenaNotFound';
    if (row.status !== 'created' && row.status !== 'started') return 'arenaOver';
    const now = this.#options.now();
    const rating = Math.round(this.#users.rating(userId, row.mode).rating);
    this.#db
      .prepare(
        `insert into arena_players (arena_id, user_id, rating, scored_at, joined_at) values (?, ?, ?, ?, ?)
         on conflict (arena_id, user_id) do update set paused = 0`,
      )
      .run(arenaId, userId, rating, now, now);
    this.#options.changed(arenaId);
    return null;
  }

  /** Before the start, leaves the Arena; while it runs, pauses (no more pairings until the player comes back). */
  pause(arenaId: string, userId: string): ErrorCode | null {
    const row = this.#row(arenaId);
    if (!row) return 'arenaNotFound';
    if (row.status === 'created') this.#db.prepare('delete from arena_players where arena_id = ? and user_id = ?').run(arenaId, userId);
    else if (row.status === 'started') this.#db.prepare('update arena_players set paused = 1 where arena_id = ? and user_id = ?').run(arenaId, userId);
    else return 'arenaOver';
    this.#options.changed(arenaId);
    return null;
  }

  /** An Arena game is over: score it, unless it was aborted or ended after the Arena. */
  gameFinished(room: GameRoom): void {
    if (!room.arena) return;
    const pairing = this.#db.prepare('select * from arena_pairings where game_id = ?').get(room.id) as PairingRow | undefined;
    if (!pairing || pairing.status !== 'started') return;
    const row = this.#row(pairing.arena_id);
    const now = this.#options.now();
    const counts = row !== undefined && row.status === 'started' && room.status === 'ended' && now < this.#endsAt(row);
    if (!counts) {
      this.#db.prepare('update arena_pairings set status = ?, winner = ?, ended_at = ? where game_id = ?').run(room.status === 'ended' ? 'ended' : 'aborted', room.outcome?.winner ?? null, now, room.id);
      // A game aborted because someone never moved: whoever is no longer on the page is paused, as on lichess, so they
      // do not keep getting paired (and keep the next opponent waiting a minute) until they come back.
      if (row?.status === 'started' && room.status === 'aborted') {
        for (const userId of [pairing.white_user, pairing.black_user]) {
          if (userId && !this.#options.presence(row.id, userId, room.id)) {
            this.#db.prepare('update arena_players set paused = 1 where arena_id = ? and user_id = ?').run(row.id, userId);
          }
        }
      }
      if (row) this.#options.changed(row.id);
      return;
    }
    const points: Record<Color, { points: number; doubled: boolean }> = { white: { points: 0, doubled: false }, black: { points: 0, doubled: false } };
    for (const color of ['white', 'black'] as const) {
      const userId = color === 'white' ? pairing.white_user : pairing.black_user;
      if (!userId) continue;
      const player = this.#db.prepare('select streak, drew from arena_players where arena_id = ? and user_id = ?').get(row.id, userId) as { streak: number; drew: number } | undefined;
      if (!player) continue;
      const winner = room.outcome?.winner ?? null;
      const result = winner === null ? 'draw' : winner === color ? 'win' : 'loss';
      const scored = arenaPoints(result, { wins: player.streak, drew: player.drew === 1 }, room.boardMoves);
      points[color] = { points: scored.points, doubled: scored.doubled };
      this.#db
        .prepare(
          `update arena_players set score = score + ?1, games = games + 1, wins = wins + ?2, losses = losses + ?3, streak = ?4, drew = ?5,
           scored_at = case when ?1 > 0 then ?6 else scored_at end where arena_id = ?7 and user_id = ?8`,
        )
        .run(scored.points, result === 'win' ? 1 : 0, result === 'loss' ? 1 : 0, scored.streak.wins, scored.streak.drew ? 1 : 0, now, row.id, userId);
    }
    this.#db
      .prepare(
        `update arena_pairings set status = 'ended', winner = ?, white_points = ?, black_points = ?, white_doubled = ?, black_doubled = ?,
         counted = 1, ended_at = ? where game_id = ?`,
      )
      .run(room.outcome?.winner ?? null, points.white.points, points.black.points, points.white.doubled ? 1 : 0, points.black.doubled ? 1 : 0, now, room.id);
    this.#options.changed(row.id);
  }

  view(arenaId: string, viewerId: string | null): ArenaView | null {
    return this.viewer(arenaId)?.(viewerId) ?? null;
  }

  /**
   * The Arena as each viewer sees it: the standings and games are built once, and only the viewer's own state per
   * call, so sending a change to everyone on the page costs one standings, not one per viewer.
   */
  viewer(arenaId: string): ((viewerId: string | null) => ArenaView) | null {
    const row = this.#row(arenaId);
    return row ? this.#view(row) : null;
  }

  /** The Arena running, else the next one, and the latest finished or canceled ones. */
  list(viewerId: string | null): ArenaList {
    const current = this.#db
      .prepare(`select * from arenas where status in ('created', 'started') order by case status when 'started' then 0 else 1 end, starts_at limit 1`)
      .get() as ArenaRow | undefined;
    const recent = this.#db
      .prepare(`select * from arenas where status in ('finished', 'canceled') order by starts_at desc limit ?`)
      .all(ARENA_RECENT) as unknown as ArenaRow[];
    return { current: current ? this.#view(current)(viewerId) : null, recent: recent.map((row) => this.#summary(row)) };
  }

  /** A player's trophies, counts and latest Arenas, for the profile. */
  playerArenas(userId: string): PlayerArenas {
    const counts = this.#db
      .prepare(
        `select sum(kind = 'arenaChampion') as champion, sum(kind in ('arenaSecond', 'arenaThird')) as podium, sum(kind = 'arenaTop') as top
         from trophies where user_id = ?`,
      )
      .get(userId) as { champion: number | null; podium: number | null; top: number | null };
    const arenas = this.#db
      .prepare(`select count(*) as n from arena_players join arenas on arenas.id = arena_players.arena_id where user_id = ? and games > 0 and arenas.status = 'finished'`)
      .get(userId) as { n: number };
    const trophies = (this.#db.prepare('select * from trophies where user_id = ? order by created_at desc, id desc limit ?').all(userId, PROFILE_TROPHIES) as unknown as TrophyRow[]).flatMap((t) => this.#trophyView(t));
    const history = this.#db
      .prepare(
        `select arenas.id, arenas.starts_at, arena_players.rank, arena_players.games, arena_players.score,
           (select count(*) from arena_players others where others.arena_id = arenas.id and others.games > 0) as players
         from arena_players join arenas on arenas.id = arena_players.arena_id
         where arena_players.user_id = ? and arena_players.games > 0 and arenas.status = 'finished'
         order by arenas.starts_at desc limit ?`,
      )
      .all(userId, PROFILE_ARENAS) as Array<{ id: string; starts_at: number; rank: number | null; games: number; score: number; players: number }>;
    return {
      counts: { champion: counts.champion ?? 0, podium: counts.podium ?? 0, top: counts.top ?? 0, arenas: arenas.n },
      trophies,
      history: history.map((h) => ({ arena: h.id, at: h.starts_at, rank: h.rank ?? 0, players: h.players, games: h.games, score: h.score })),
    };
  }

  /** The trophies in a data export. */
  exportFor(userId: string): TrophyView[] {
    return (this.#db.prepare('select * from trophies where user_id = ? order by created_at').all(userId) as unknown as TrophyRow[]).flatMap((t) => this.#trophyView(t));
  }

  #trophyView(row: TrophyRow): TrophyView[] {
    const kind = TROPHY_KINDS.find((k) => k === row.kind);
    return kind ? [{ kind, arena: row.arena_id, place: row.place, players: row.players, season: row.season, at: row.created_at }] : [];
  }

  #row(id: string): ArenaRow | undefined {
    return this.#db.prepare('select * from arenas where id = ?').get(id) as ArenaRow | undefined;
  }

  #endsAt(row: ArenaRow): number {
    return (row.started_at ?? row.starts_at) + row.duration * MINUTE;
  }

  #ensureUpcoming(now: number): void {
    const open = this.#db.prepare(`select 1 from arenas where status in ('created', 'started')`).get();
    if (!open) this.create(nextArenaStart(now));
  }

  #joined(arenaId: string): number {
    return (this.#db
      .prepare(`select count(*) as n from arena_players join users on users.id = arena_players.user_id where arena_id = ? and ${NOT_BANNED}`)
      .get(arenaId) as { n: number }).n;
  }

  #joinedIds(arenaId: string): string[] {
    return (this.#db.prepare('select user_id from arena_players where arena_id = ?').all(arenaId) as Array<{ user_id: string }>).map((r) => r.user_id);
  }

  #beforeStart(row: ArenaRow, now: number): void {
    if (!row.announced && now >= row.starts_at - ARENA.announceMinutes * MINUTE) {
      this.#db.prepare('update arenas set announced = 1 where id = ?').run(row.id);
      if (now < row.starts_at) this.#options.announce({ kind: 'soon', arena: row.id, startsAt: row.starts_at, joined: this.#joined(row.id) });
    }
    if (!row.reminded && now >= row.starts_at - ARENA.reminderMinutes * MINUTE) {
      this.#db.prepare('update arenas set reminded = 1 where id = ?').run(row.id);
      if (now < row.starts_at) for (const userId of this.#joinedIds(row.id)) this.#options.notice(userId, 'arenaSoon', { ref: row.id });
    }
    if (now < row.starts_at) return;
    const joined = this.#joined(row.id);
    if (joined >= row.min_players) {
      this.#db.prepare(`update arenas set status = 'started', started_at = ? where id = ?`).run(now, row.id);
      this.#options.announce({ kind: 'started', arena: row.id, joined });
      this.#options.changed(row.id);
      this.#pair({ ...row, status: 'started', started_at: now }, now);
    } else if (now >= row.starts_at + ARENA.startGraceMinutes * MINUTE) {
      this.#db.prepare(`update arenas set status = 'canceled', finished_at = ? where id = ?`).run(now, row.id);
      if (this.#options.schedule) this.#ensureUpcoming(now);
      this.#options.announce({ kind: 'canceled', arena: row.id, joined, next: this.#nextStart() });
      this.#options.changed(row.id);
    }
  }

  #nextStart(): number | null {
    const next = this.#db.prepare(`select starts_at from arenas where status = 'created' order by starts_at limit 1`).get() as { starts_at: number } | undefined;
    return next?.starts_at ?? null;
  }

  #pair(row: ArenaRow, now: number): void {
    if (now >= this.#endsAt(row) - ARENA.pairingCutoffMinutes * MINUTE) return;
    const pairings = this.#db.prepare('select * from arena_pairings where arena_id = ? order by created_at').all(row.id) as unknown as PairingRow[];
    const lastGame = new Map<string, PairingRow>();
    const balance = new Map<string, number>();
    for (const p of pairings) {
      if (p.white_user) {
        lastGame.set(p.white_user, p);
        balance.set(p.white_user, (balance.get(p.white_user) ?? 0) + 1);
      }
      if (p.black_user) {
        lastGame.set(p.black_user, p);
        balance.set(p.black_user, (balance.get(p.black_user) ?? 0) - 1);
      }
    }
    const players = this.#db
      .prepare(`select arena_players.*, users.username from arena_players join users on users.id = arena_players.user_id where arena_id = ? and paused = 0 and ${NOT_BANNED}`)
      .all(row.id) as unknown as PlayerRow[];
    const sessions = new Map<string, { session: string; name: string }>();
    const candidates: PairingCandidate[] = [];
    for (const player of players) {
      const last = lastGame.get(player.user_id);
      if (last && (last.status === 'started' || (last.ended_at !== null && now - last.ended_at < REST_MS))) continue;
      if (this.#options.busy(player.user_id)) continue;
      const session = this.#options.presence(row.id, player.user_id, last?.game_id ?? null);
      if (!session) continue;
      sessions.set(player.user_id, { session, name: player.username });
      const lastOpponent = last ? (last.white_user === player.user_id ? last.black_user : last.white_user) : null;
      const freeSince = last?.ended_at ?? Math.max(row.started_at ?? row.starts_at, player.joined_at);
      candidates.push({ id: player.user_id, score: player.score, rating: player.rating, lastOpponent, colorBalance: balance.get(player.user_id) ?? 0, freeSince });
    }
    const pairs = pairCandidates(candidates, this.#options.random);
    for (const pair of pairs) {
      const seat = (userId: string) => ({ sessionId: sessions.get(userId)!.session, userId, name: sessions.get(userId)!.name });
      const room = this.#games.create({
        mode: row.mode,
        rated: true,
        timeControl: { initial: row.clock_initial, increment: row.clock_increment },
        daysPerMove: null,
        freeDraft: false,
        players: { white: seat(pair.white), black: seat(pair.black) },
        arena: row.id,
      });
      const rating = (color: Color) => room.seats[color].rating ?? Math.round(this.#users.rating(room.seats[color].userId!, row.mode).rating);
      this.#db
        .prepare(`insert into arena_pairings (game_id, arena_id, white_user, black_user, white_rating, black_rating, status, created_at) values (?, ?, ?, ?, ?, ?, 'started', ?)`)
        .run(room.id, row.id, pair.white, pair.black, rating('white'), rating('black'), now);
      this.#options.gameStarted(room);
    }
    if (pairs.length) this.#options.changed(row.id);
  }

  #finish(row: ArenaRow, now: number): void {
    this.#db.prepare(`update arenas set status = 'finished', finished_at = ? where id = ?`).run(now, row.id);
    const finished = { ...row, status: 'finished' as const, finished_at: now };
    const standings = this.#standings(finished, true);
    const setRank = this.#db.prepare('update arena_players set rank = ? where arena_id = ? and user_id = ?');
    for (const s of standings) setRank.run(s.rank, row.id, s.user.id);
    const played = standings.filter((s) => s.games > 0);
    const players = played.length;
    const prizes = arenaPrizes(players);
    const eligible = played.filter((s) => s.games >= ARENA.trophyMinGames);
    const awards = new Map<string, TrophyKind>();
    const podium: TrophyKind[] = prizes.podium ? ['arenaChampion', 'arenaSecond', 'arenaThird'] : prizes.champion ? ['arenaChampion'] : [];
    podium.forEach((kind, i) => {
      const winner = eligible[i];
      if (winner) awards.set(winner.user.id, kind);
    });
    if (prizes.top) {
      const top = arenaTopCount(players);
      for (const s of eligible) if (s.rank <= top && !awards.has(s.user.id)) awards.set(s.user.id, 'arenaTop');
    }
    const insert = this.#db.prepare('insert into trophies (user_id, kind, arena_id, place, players, season, created_at) values (?, ?, ?, ?, ?, ?, ?)');
    for (const s of played) {
      const kind = awards.get(s.user.id);
      if (kind) insert.run(s.user.id, kind, row.id, s.rank, players, row.season, now);
      this.#options.notice(s.user.id, 'arenaResult', { ref: row.id, subject: `${s.rank}/${players}${kind ? `/${kind}` : ''}` });
    }
    const championId = [...awards].find(([, kind]) => kind === 'arenaChampion')?.[0] ?? null;
    const champion = championId ? (played.find((s) => s.user.id === championId)?.user ?? null) : null;
    const previous = this.#db
      .prepare(`select user_id from trophies where kind = 'arenaChampion' and arena_id != ? order by created_at desc, id desc limit 1`)
      .get(row.id) as { user_id: string } | undefined;
    if (this.#options.schedule) this.#ensureUpcoming(now);
    this.#options.announce({
      kind: 'finished',
      arena: row.id,
      players,
      podium: played.slice(0, 3).map((s) => ({ user: s.user, rank: s.rank, score: s.score })),
      champion,
      previousChampion: previous?.user_id ?? null,
      next: this.#nextStart(),
    });
    this.#options.changed(row.id);
  }

  #view(row: ArenaRow): (viewerId: string | null) => ArenaView {
    const running = row.status === 'started';
    const standings = this.#standings(row, false);
    const ongoing = (this.#db.prepare(`select game_id from arena_pairings where arena_id = ? and status = 'started'`).all(row.id) as Array<{ game_id: string }>)
      .flatMap(({ game_id }) => {
        const room = this.#games.get(game_id);
        return room && room.status === 'started' ? [room] : [];
      })
      .sort((a, b) => (b.seats.white.rating ?? 0) + (b.seats.black.rating ?? 0) - ((a.seats.white.rating ?? 0) + (a.seats.black.rating ?? 0)))
      .map((room) => room.summary());
    const you = (viewerId: string) => {
      const me = this.#db.prepare('select paused from arena_players where arena_id = ? and user_id = ?').get(row.id, viewerId) as { paused: number } | undefined;
      const game = ongoing.find((g) => g.players.white.user?.id === viewerId || g.players.black.user?.id === viewerId)?.id ?? null;
      return { joined: me !== undefined, paused: me?.paused === 1, game };
    };
    const base = {
      id: row.id,
      status: row.status,
      mode: row.mode,
      timeControl: { initial: row.clock_initial, increment: row.clock_increment },
      rated: true,
      durationMinutes: row.duration,
      minPlayers: row.min_players,
      startsAt: row.starts_at,
      startedAt: row.started_at,
      endsAt: row.started_at === null ? null : this.#endsAt(row),
      finishedAt: row.finished_at,
      season: row.season,
      players: standings.filter((s) => s.games > 0).length,
      standings,
      games: running ? ongoing : [],
    };
    return (viewerId) => ({ ...base, you: viewerId ? you(viewerId) : null });
  }

  /** The standings: by points, then performance, then who reached their score first; final places once finished. */
  #standings(row: ArenaRow, finishing: boolean): ArenaStanding[] {
    const players = this.#db
      .prepare(`select arena_players.*, users.username from arena_players join users on users.id = arena_players.user_id where arena_id = ? and ${NOT_BANNED}`)
      .all(row.id) as unknown as PlayerRow[];
    const pairings = this.#db.prepare('select * from arena_pairings where arena_id = ? order by created_at').all(row.id) as unknown as PairingRow[];
    const sheets = new Map<string, ArenaSheetEntry[]>();
    const opponents = new Map<string, number[]>();
    const playing = new Map<string, string>();
    for (const p of pairings) {
      for (const color of ['white', 'black'] as const) {
        const userId = color === 'white' ? p.white_user : p.black_user;
        if (!userId) continue;
        if (p.status === 'started') playing.set(userId, p.game_id);
        if (!p.counted) continue;
        const entry = color === 'white' ? { points: p.white_points ?? 0, doubled: p.white_doubled === 1 } : { points: p.black_points ?? 0, doubled: p.black_doubled === 1 };
        sheets.set(userId, [...(sheets.get(userId) ?? []), entry]);
        opponents.set(userId, [...(opponents.get(userId) ?? []), color === 'white' ? p.black_rating : p.white_rating]);
      }
    }
    const trophies = new Map(
      (this.#db.prepare('select user_id, kind from trophies where arena_id = ?').all(row.id) as Array<{ user_id: string; kind: string }>).flatMap((t) => {
        const kind = TROPHY_KINDS.find((k) => k === t.kind);
        return kind ? [[t.user_id, kind] as const] : [];
      }),
    );
    const running = row.status === 'started';
    const lastGame = new Map<string, string>();
    for (const p of pairings) {
      if (p.white_user) lastGame.set(p.white_user, p.game_id);
      if (p.black_user) lastGame.set(p.black_user, p.game_id);
    }
    const rows = players.map((player) => {
      const performance = arenaPerformance(opponents.get(player.user_id) ?? [], player.wins, player.losses);
      const rating = this.#users.rating(player.user_id, row.mode);
      const state = !running
        ? null
        : playing.has(player.user_id)
          ? ('playing' as const)
          : player.paused === 0 && this.#options.presence(row.id, player.user_id, lastGame.get(player.user_id) ?? null)
            ? ('waiting' as const)
            : ('away' as const);
      return {
        player,
        standing: {
          rank: 0,
          user: { id: player.user_id, name: player.username },
          rating: Math.round(rating.rating),
          provisional: rating.deviation > PROVISIONAL_DEVIATION,
          score: player.score,
          games: player.games,
          wins: player.wins,
          performance,
          fire: player.streak >= 2,
          sheet: sheets.get(player.user_id) ?? [],
          state,
          trophy: trophies.get(player.user_id) ?? null,
        } satisfies ArenaStanding,
      };
    });
    const stored = row.status === 'finished' && !finishing;
    rows.sort((a, b) =>
      stored
        ? (a.player.rank ?? Infinity) - (b.player.rank ?? Infinity)
        : b.player.score - a.player.score ||
          (b.standing.performance ?? -Infinity) - (a.standing.performance ?? -Infinity) ||
          a.player.scored_at - b.player.scored_at ||
          a.player.joined_at - b.player.joined_at,
    );
    return rows.map(({ player, standing }, i) => ({ ...standing, rank: stored ? (player.rank ?? i + 1) : i + 1 }));
  }

  #summary(row: ArenaRow): ArenaSummary {
    const counts = this.#db
      .prepare(`select count(*) as joined, sum(games > 0) as players from arena_players join users on users.id = arena_players.user_id where arena_id = ? and ${NOT_BANNED}`)
      .get(row.id) as { joined: number; players: number | null };
    const winner = this.#db
      .prepare(`select users.id, users.username from trophies join users on users.id = trophies.user_id where arena_id = ? and kind = 'arenaChampion' and ${NOT_BANNED}`)
      .get(row.id) as { id: string; username: string } | undefined;
    return {
      id: row.id,
      status: row.status,
      startsAt: row.starts_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      players: counts.players ?? 0,
      joined: counts.joined,
      winner: winner ? { id: winner.id, name: winner.username } : null,
    };
  }
}

interface TrophyRow {
  id: number;
  user_id: string;
  kind: string;
  arena_id: string;
  place: number;
  players: number;
  season: string;
  created_at: number;
}

import { legalMoves, moveToString, parseFen } from '@ligungi/engine';
import { RACE_COUNTDOWN_MS, RACE_MAX_PLAYERS, RACE_PUBLIC_WAIT_MS, RACE_TIME_MS, racerBonus } from '@ligungi/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../src/db.ts';
import type { Player } from '../src/games.ts';
import { Racers } from '../src/racer.ts';
import { Users } from '../src/users.ts';
import { Client, startServer, type TestServer } from './helpers.ts';

// Known puzzles: a material one (3 plies), two mates in 1 and a mate in 2.
const MATERIAL = { id: '1e6fd35f', fen: '9/9/(pr)2(ff)5/1(py)2(pl)3m/8p/9/P1J2r3/1(YR)2n4/8M b - intro p w', line: ['e6e5', 'i1h1', 'e5c3x'] };
const MATE_1 = { id: '0a58673c', line: ['d3b5='] };
const MATE_1B = { id: '15b08ef7', line: ['e6b3'] };
const MATE_2 = { id: '233c9982', line: ['e5e2', 'f1g1', 'e2e1'] };
const SEQUENCE = [MATERIAL.id, MATE_1.id, MATE_2.id, MATE_1B.id, ...Array.from({ length: 60 }, () => MATE_1.id)];

const setup = (randoms: number[] = []) => {
  const db = openDatabase(':memory:');
  let now = 1_000_000;
  const changes: string[] = [];
  const racers = new Racers(db, {
    now: () => now,
    random: () => randoms.shift() ?? 0.99,
    sequence: () => [...SEQUENCE],
    onChange: (id) => changes.push(id),
    schedule: () => undefined,
  });
  const users = new Users(db, () => now);
  return {
    db,
    racers,
    changes,
    users,
    advance: (ms: number) => {
      now += ms;
    },
  };
};

const guest = (n: number): Player => ({ sessionId: `s${n}`, userId: null, name: 'Anonymous' });

describe('Puzzle Racer', () => {
  it('opens a public race that starts after a wait, and starts sooner once full', () => {
    const { racers, advance } = setup();
    const id = racers.joinPublic(guest(1));
    expect(racers.view(id, guest(1))).toMatchObject({ kind: 'public', status: 'countdown', startsIn: RACE_PUBLIC_WAIT_MS, endsIn: RACE_PUBLIC_WAIT_MS + RACE_TIME_MS });
    expect(racers.joinPublic(guest(2))).toBe(id);
    expect(racers.waiting()).toBe(2);
    for (let n = 3; n <= RACE_MAX_PLAYERS; n++) racers.joinPublic(guest(n));
    expect(racers.view(id, guest(1))!.startsIn).toBe(RACE_COUNTDOWN_MS);
    // A full race takes nobody else: the next player opens a new one.
    expect(racers.joinPublic(guest(99))).not.toBe(id);
    advance(RACE_COUNTDOWN_MS);
    expect(racers.view(id, guest(1))!.status).toBe('racing');
  });

  it('starts a private race only when its creator says so, and takes nobody once it runs', () => {
    const { racers, advance } = setup();
    const id = racers.create(guest(1), 'friends');
    expect(racers.view(id, guest(1))).toMatchObject({ status: 'waiting', owner: true, puzzles: null });
    expect(racers.join(id, guest(2))).toBeNull();
    expect(racers.start(id, guest(2))).toBe('notRaceOwner');
    expect(racers.start(id, guest(1))).toBeNull();
    expect(racers.view(id, guest(2))).toMatchObject({ status: 'countdown', owner: false, startsIn: RACE_COUNTDOWN_MS, puzzles: SEQUENCE });
    advance(RACE_COUNTDOWN_MS);
    expect(racers.join(id, guest(3))).toBe('raceStarted');
    expect(racers.join('nope', guest(3))).toBe('raceNotFound');
  });

  it('keeps a call race to the people of that call', () => {
    const { racers } = setup();
    const id = racers.create(guest(1), 'call', 'call-1');
    expect(racers.callRace('call-1')).toEqual({ id, status: 'waiting', players: 1 });
    expect(racers.join(id, guest(2))).toBe('notInActivity');
    expect(racers.join(id, guest(2), 'call-2')).toBe('notInActivity');
    expect(racers.join(id, guest(2), 'call-1')).toBeNull();
  });

  it('scores right moves on the server, moves on after a wrong one, and allows one skip', () => {
    const { racers, advance } = setup();
    const me = guest(1);
    const id = racers.create(me, 'friends');
    // Before the start, moves do not count.
    expect(racers.move(id, me, 0, MATERIAL.line[0]!)).toBeNull();
    racers.start(id, me);
    advance(RACE_COUNTDOWN_MS);

    // Material: the first move is right and the opponent answers, then the last move solves it.
    expect(racers.move(id, me, 0, MATERIAL.line[0]!)).toBe(true);
    expect(racers.view(id, me)!.you).toMatchObject({ index: 0, score: 1, combo: 1 });
    expect(racers.move(id, me, 0, MATERIAL.line[2]!)).toBe(true);
    expect(racers.view(id, me)!.you).toMatchObject({ index: 1, score: 2, combo: 2 });

    // A move for a puzzle already left behind is ignored.
    expect(racers.move(id, me, 0, MATERIAL.line[0]!)).toBeNull();

    // A wrong move on the mate in 1: no point, combo lost, next puzzle.
    const position = parseFen('9/4(nl)4/p2(fr)4(py)/m6(pj)1/1Ry6/4(FP)f3/3(SJ)3P(PN)/1Y2(NR)4/1M7 w - intro p w');
    const wrong = legalMoves(position).map(moveToString).find((text) => text !== MATE_1.line[0]);
    expect(racers.move(id, me, 1, wrong!)).toBe(false);
    expect(racers.view(id, me)!.you).toMatchObject({ index: 2, score: 2, combo: 0 });

    expect(racers.skip(id, me, 2)).toBe(true);
    expect(racers.skip(id, me, 3)).toBe(false);
    expect(racers.view(id, me)!.you).toMatchObject({ index: 3, skipUsed: true });

    expect(racers.move(id, me, 3, MATE_1B.line[0]!)).toBe(true);
    expect(racers.view(id, me)!.you).toMatchObject({ index: 4, score: 3 });
    // An illegal move is not counted either way.
    expect(racers.move(id, me, 4, 'zz')).toBeNull();
  });

  it('adds a point at each combo mark', () => {
    const { racers, advance } = setup();
    const me = guest(1);
    const id = racers.create(me, 'friends');
    racers.start(id, me);
    advance(RACE_COUNTDOWN_MS);
    let combo = 0;
    let expected = 0;
    const right = (index: number, move: string) => {
      expect(racers.move(id, me, index, move)).toBe(true);
      combo++;
      expected += 1 + racerBonus(combo);
    };
    right(0, MATERIAL.line[0]!);
    right(0, MATERIAL.line[2]!);
    right(1, MATE_1.line[0]!);
    right(2, MATE_2.line[0]!);
    right(2, MATE_2.line[2]!);
    right(3, MATE_1B.line[0]!);
    for (let index = 4; index < 12; index++) right(index, MATE_1.line[0]!);
    expect(racers.view(id, me)!.you).toMatchObject({ index: 12, combo: 14, score: expected });
    // Marks at 5 and 12: two extra points.
    expect(expected).toBe(16);
  });

  it('ends the race on time, keeps the results and reuses public puzzles with their players as ghosts', () => {
    const { racers, advance, users, db } = setup([0.99, 0.1, 0.1, 0, 0.5, 0.5, 0.1]);
    const ana = users.create('Ana', 'x')!;
    const anaPlayer: Player = { sessionId: 'sa', userId: ana.id, name: 'Ana' };
    const id = racers.joinPublic(anaPlayer);
    racers.joinPublic(guest(2));
    advance(RACE_PUBLIC_WAIT_MS);
    racers.move(id, anaPlayer, 0, MATERIAL.line[0]!);
    racers.move(id, anaPlayer, 0, MATERIAL.line[2]!);
    // A move right at the end still counts (it may have been sent just before), but not one past the margin.
    advance(RACE_TIME_MS);
    expect(racers.view(id, anaPlayer)!.status).toBe('racing');
    advance(1_000);
    expect(racers.move(id, guest(2), 0, MATERIAL.line[0]!)).toBeNull();
    expect(racers.view(id, anaPlayer)!.status).toBe('finished');
    expect(racers.records(ana.id)).toMatchObject({ best: 2, recent: [{ score: 2 }] });
    // The guest scored nothing, so only Ana's race is kept.
    expect((db.prepare('select count(*) as n from race_results').get() as { n: number }).n).toBe(1);

    // A new public race reuses that set: Ana runs alongside as a ghost, with her score along the race.
    const next = racers.joinPublic(guest(3));
    const view = racers.view(next, guest(3))!;
    expect(view.ghosts).toEqual([{ name: 'Ana', user: { id: ana.id, name: 'Ana' }, guest: null, points: [[0, 1], [0, 2]] }]);
    expect(view.puzzles).toEqual(SEQUENCE);
    // Ana herself never gets her own set back.
    advance(RACE_PUBLIC_WAIT_MS + RACE_TIME_MS + 2_000);
    const hers = racers.joinPublic(anaPlayer);
    expect(racers.view(hers, anaPlayer)!.ghosts).toEqual([]);
  });
});

describe('Puzzle Racer edge cases', () => {
  it('never shows a later player of a public race their own ghost', () => {
    const { racers, advance, users } = setup([0.99, 0.1, 0, 0.5]);
    const bia = users.create('Bia', 'x')!;
    const biaPlayer: Player = { sessionId: 'sb', userId: bia.id, name: 'Bia' };
    const first = racers.joinPublic(biaPlayer);
    advance(RACE_PUBLIC_WAIT_MS);
    racers.move(first, biaPlayer, 0, MATERIAL.line[0]!);
    advance(RACE_TIME_MS + 1_000);
    expect(racers.view(first, biaPlayer)!.status).toBe('finished');
    // A guest opens a public race over Bia's puzzles, with her as a ghost; Bia joins it and does not see herself.
    const next = racers.joinPublic(guest(1));
    expect(racers.view(next, guest(1))!.ghosts.map((ghost) => ghost.name)).toEqual(['Bia']);
    racers.joinPublic(biaPlayer);
    expect(racers.view(next, biaPlayer)!.ghosts).toEqual([]);
  });

  it('ends the race even when its results cannot be kept', () => {
    const { racers, advance, db } = setup();
    const ghost: Player = { sessionId: 'sx', userId: 'gone', name: 'Gone' };
    const id = racers.create(ghost, 'friends');
    racers.start(id, ghost);
    advance(RACE_COUNTDOWN_MS);
    racers.move(id, ghost, 0, MATERIAL.line[0]!);
    advance(RACE_TIME_MS + 1_000);
    // The account does not exist, so keeping its result breaks the foreign key: the race still ends.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(racers.view(id, ghost)!.status).toBe('finished');
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
    expect((db.prepare('select count(*) as n from race_results').get() as { n: number }).n).toBe(0);
  });
});

describe('Puzzle Racer routes', () => {
  let server: TestServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('creates a race by link, lets others join and only its creator start it', async () => {
    server = await startServer();
    const owner = new Client(server.base);
    const friend = new Client(server.base);
    const { id } = (await owner.request<{ id: string }>('POST', '/api/racer')).data;
    expect((await owner.request('GET', `/api/racer/${id}`)).data).toMatchObject({ kind: 'friends', status: 'waiting', owner: true });
    expect((await friend.request('POST', `/api/racer/${id}/join`, {})).data).toEqual({ ok: true });
    expect((await friend.request('POST', `/api/racer/${id}/start`)).data).toMatchObject({ code: 'notRaceOwner' });
    expect((await owner.request('POST', `/api/racer/${id}/start`)).data).toEqual({ ok: true });
    const view = (await friend.request<{ status: string; players: unknown[]; puzzles: string[] }>('GET', `/api/racer/${id}`)).data;
    expect(view).toMatchObject({ status: 'countdown', owner: false });
    expect(view.players).toHaveLength(2);
    expect(view.puzzles.length).toBeGreaterThan(40);
    expect((await friend.request('GET', '/api/racer/nothere')).data).toMatchObject({ code: 'raceNotFound' });
    expect((await friend.request('GET', '/api/racer')).data).toEqual({ records: null, waiting: 0 });
    const pub = (await friend.request<{ id: string }>('POST', '/api/racer/public')).data.id;
    expect((await owner.request<{ id: string }>('POST', '/api/racer/public')).data.id).toBe(pub);
    expect((await owner.request('GET', '/api/racer')).data).toMatchObject({ waiting: 2 });
  });
});

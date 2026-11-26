import { describe, expect, it } from 'vitest';
import { Clock } from '../src/clock.ts';
import { openDatabase } from '../src/db.ts';
import { Games, type Player } from '../src/games.ts';
import { applyMove, legalMoves, moveToString, type Position } from '@ligungi/engine';
import { DEFAULT_RATING, updateRating } from '../src/glicko.ts';
import { base32Decode, base32Encode, hotp, matchStep, newRecoveryCodes, normalizeCode, otpauthUri, TOTP_STEP_MS } from '../src/totp.ts';
import { TV_LINGER_MS, Tv } from '../src/tv.ts';
import { TwoFactor } from '../src/two-factor.ts';
import { Users } from '../src/users.ts';
import { parseCookies } from '../src/auth.ts';
import { randomId } from '../src/ids.ts';

describe('ids and cookies', () => {
  it('draws ids of the asked length from the alphabet only', () => {
    for (const length of [1, 8, 24, 200]) expect(randomId(length)).toMatch(new RegExp(`^[a-km-zA-HJ-NP-Z2-9]{${length}}$`));
  });

  it('keeps a cookie named like an object property as a plain key', () => {
    const cookies = parseCookies('__proto__=x; constructor=y; sid=abc');
    expect(cookies.get('sid')).toBe('abc');
    expect(cookies.get('__proto__')).toBe('x');
    expect(cookies.get('constructor')).toBe('y');
  });
});

describe('clock', () => {
  it('charges the mover, adds the increment and keeps running for consecutive draft moves', () => {
    const clock = new Clock({ initial: 60, increment: 2 });
    clock.start('white', 0);
    clock.press('white', 'black', 10_000);
    expect(clock.view(10_000)).toEqual({ white: 52_000, black: 60_000, running: 'black' });
    clock.press('black', 'black', 15_000);
    expect(clock.view(20_000)).toEqual({ white: 52_000, black: 52_000, running: 'black' });
    clock.stop(20_000);
    expect(clock.view(99_000).running).toBeNull();
    expect(clock.timeLeft('black', 99_000)).toBe(52_000);
  });

  it('runs byo-yomi: the main time first, then a period that resets after each move and is lost when overrun', () => {
    const clock = new Clock({ initial: 60, increment: 0, byoyomi: 10, periods: 2 });
    expect(clock.view(0)).toEqual({ white: 80_000, black: 80_000, running: null });
    clock.start('white', 0);
    // Within the main time: no increment, nothing else changes.
    clock.press('white', 'black', 20_000);
    expect(clock.timeLeft('white', 20_000)).toBe(60_000);
    clock.press('black', 'white', 20_000);
    // 45 s used: the 40 s of main time and 5 s of the first period. The move resets the period.
    clock.press('white', 'black', 65_000);
    expect(clock.timeLeft('white', 65_000)).toBe(20_000);
    clock.press('black', 'white', 65_000);
    // 13 s: the first period is overrun and gone; the second one starts full again.
    clock.press('white', 'black', 78_000);
    expect(clock.timeLeft('white', 78_000)).toBe(10_000);
    clock.press('black', 'white', 78_000);
    // The last period overrun: the flag falls.
    expect(clock.timeLeft('white', 88_000)).toBe(0);
    // Extra time would count as periods, so it is not given.
    clock.add('black', 15_000);
    expect(clock.timeLeft('black', 88_000)).toBe(80_000);
  });

  it('never reports negative time', () => {
    const clock = new Clock({ initial: 60, increment: 0 });
    clock.start('white', 0);
    expect(clock.timeLeft('white', 120_000)).toBe(0);
  });
});

describe('glicko-2', () => {
  it('moves ratings in the expected direction and shrinks the deviation', () => {
    const win = updateRating(DEFAULT_RATING, DEFAULT_RATING, 1);
    const loss = updateRating(DEFAULT_RATING, DEFAULT_RATING, 0);
    const draw = updateRating(DEFAULT_RATING, DEFAULT_RATING, 0.5);
    expect(win.rating).toBeGreaterThan(1500);
    expect(loss.rating).toBeLessThan(1500);
    expect(Math.round(draw.rating)).toBe(1500);
    expect(win.deviation).toBeLessThan(350);
    expect(Math.round(win.rating - 1500)).toBe(Math.round(1500 - loss.rating));
  });

  it('matches the reference example of the Glicko-2 paper for one game', () => {
    const player = { rating: 1500, deviation: 200, volatility: 0.06 };
    const updated = updateRating(player, { rating: 1400, deviation: 30, volatility: 0.06 }, 1);
    expect(updated.rating).toBeGreaterThan(1500);
    expect(updated.deviation).toBeLessThan(200);
    expect(updated.volatility).toBeCloseTo(0.06, 3);
  });
});

describe('totp', () => {
  const rfcSecret = Buffer.from('12345678901234567890');

  it('matches the HOTP test values of RFC 4226', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
    expect(expected.map((_, counter) => hotp(rfcSecret, counter))).toEqual(expected);
  });

  it('matches the SHA-1 TOTP test values of RFC 6238', () => {
    const cases: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ];
    for (const [seconds, code] of cases) expect(hotp(rfcSecret, Math.floor((seconds * 1000) / TOTP_STEP_MS), 8)).toBe(code);
  });

  it('round-trips base32 and accepts a code one step around now', () => {
    expect(base32Encode(rfcSecret)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).toEqual(rfcSecret);
    const secret = base32Encode(rfcSecret);
    const now = 1_700_000_000_000;
    const step = Math.floor(now / TOTP_STEP_MS);
    for (const offset of [-1, 0, 1]) expect(matchStep(secret, hotp(rfcSecret, step + offset), now)).toBe(step + offset);
    expect(matchStep(secret, hotp(rfcSecret, step + 2), now)).toBeNull();
    expect(matchStep(secret, '12345', now)).toBeNull();
    expect(otpauthUri('Gon', secret)).toBe(`otpauth://totp/ligungi:Gon?secret=${secret}&issuer=ligungi`);
  });

  it('makes ten distinct recovery codes, typed back in any case and spacing', () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
    expect(normalizeCode(' ABCDE - fghij ')).toBe('abcdefghij');
  });
});

describe('two-factor sweep', () => {
  it('drops setups left unconfirmed for over 30 minutes, never one that is on', () => {
    let now = 1_700_000_000_000;
    const db = openDatabase(':memory:');
    const users = new Users(db, () => now);
    const twoFactor = new TwoFactor(db, () => now);
    const idle = users.create('Idle', 'x')!.id;
    const active = users.create('Active', 'x')!.id;
    twoFactor.begin(idle);
    const secret = twoFactor.begin(active)!;
    expect(Array.isArray(twoFactor.confirm(active, hotp(base32Decode(secret), Math.floor(now / TOTP_STEP_MS))))).toBe(true);
    now += 20 * 60_000;
    expect(twoFactor.sweep()).toBe(0);
    now += 11 * 60_000;
    expect(twoFactor.sweep()).toBe(1);
    expect(twoFactor.state(active).enabled).toBe(true);
    db.close();
  });
});

describe('board moves', () => {
  it('counts only the moves after the draft, when saved and when filled in for older games', () => {
    const db = openDatabase(':memory:');
    const users = new Users(db, Date.now);
    const options = { now: Date.now, abortAfterMs: 60_000, claimAfterMs: 30_000, broadcast: () => {} };
    const games = new Games(db, users, options);
    const [white, black] = [users.create('Pariston', 'x')!, users.create('Cheadle', 'x')!];
    const room = games.create({
      mode: 'advanced',
      rated: true,
      timeControl: null,
      daysPerMove: null,
      freeDraft: false,
      players: { white: { sessionId: 'w', userId: white.id, name: white.name }, black: { sessionId: 'b', userId: black.id, name: black.name } },
    });
    // Each side places a few pieces, then says done; afterwards five moves on the board.
    let boardMoves = 0;
    for (let ply = 0; ply < 200 && boardMoves < 5; ply++) {
      const position = room.game.position;
      const moves = legalMoves(position);
      const placed = room.game.moves.filter((move) => move.kind === 'drop').length;
      const move =
        position.phase === 'draft'
          ? (placed >= 6 ? moves.find((m) => m.kind === 'done') : undefined) ?? moves.find((m) => m.kind === 'drop')!
          : moves.find((m) => m.kind === 'move') ?? moves[0]!;
      if (position.phase === 'play') boardMoves++;
      expect(room.move(position.turn, moveToString(move), room.plies)).toBeNull();
    }
    expect(room.game.moves.length).toBeGreaterThan(boardMoves);
    room.resign('white');
    const stored = () => (db.prepare('select board_moves from games where id = ?').get(room.id) as { board_moves: number | null }).board_moves;
    expect(stored()).toBe(boardMoves);

    db.prepare('update games set board_moves = null where id = ?').run(room.id);
    new Games(db, users, options);
    expect(stored()).toBe(boardMoves);
    db.close();
  });
});

describe('correspondence draft queue', () => {
  const setup = (daysPerMove: number | null = 3) => {
    const db = openDatabase(':memory:');
    const users = new Users(db, Date.now);
    const options = { now: Date.now, abortAfterMs: 60_000, claimAfterMs: 30_000, broadcast: () => {} };
    const games = new Games(db, users, options);
    const room = games.create({
      mode: 'advanced',
      rated: true,
      timeControl: null,
      daysPerMove,
      freeDraft: false,
      players: { white: { sessionId: 'w', userId: null, name: 'White' }, black: { sessionId: 'b', userId: null, name: 'Black' } },
    });
    return { db, users, options, room };
  };
  /** Black's next `count` placements as Black would make them, from the current position. */
  const blackPlacements = (start: Position, count: number): string[] => {
    const out: string[] = [];
    let position = start;
    for (let i = 0; i < count; i++) {
      const move = legalMoves({ ...position, turn: 'black' }).find((m) => m.kind === 'drop')!;
      out.push(moveToString(move));
      position = applyMove({ ...position, turn: 'black' }, move);
    }
    return out;
  };
  const whitePlays = (room: ReturnType<typeof setup>['room']) => {
    const move = legalMoves(room.game.position).find((m) => m.kind === 'drop')!;
    expect(room.move('white', moveToString(move), room.plies)).toBeNull();
  };

  it('plays the queued placements on the player\'s turns, shows them only to that player and keeps them on a restart', () => {
    const { db, users, options, room } = setup();
    const queued = blackPlacements(room.game.position, 2);
    expect(room.queue('black', queued)).toBeNull();
    expect(room.view('b', null).draftQueue).toEqual(queued);
    expect(room.view('w', null).draftQueue).toEqual([]);

    whitePlays(room);
    expect(moveToString(room.game.moves[1]!)).toBe(queued[0]);
    expect(room.game.position.turn).toBe('white');
    expect(room.view('b', null).draftQueue).toEqual([queued[1]]);

    const restored = new Games(db, users, options).get(room.id)!;
    expect(restored.view('b', null).draftQueue).toEqual([queued[1]]);
    whitePlays(restored);
    expect(moveToString(restored.game.moves[3]!)).toBe(queued[1]);
    expect(restored.view('b', null).draftQueue).toEqual([]);
    db.close();
  });

  it('drops the rest of the queue when a placement can no longer be played', () => {
    const { db, room } = setup();
    // A placement in White's camp, which Black can never make.
    const wrong = moveToString(legalMoves(room.game.position).find((m) => m.kind === 'drop')!);
    const later = blackPlacements(room.game.position, 1);
    expect(room.queue('black', [wrong, ...later])).toBeNull();
    whitePlays(room);
    expect(room.game.position.turn).toBe('black');
    expect(room.view('b', null).draftQueue).toEqual([]);
    db.close();
  });

  it('is only for the draft of a correspondence game, with done last and placements only', () => {
    const live = setup(null);
    expect(live.room.queue('black', blackPlacements(live.room.game.position, 1))).toBe('queueUnavailable');
    live.db.close();
    const { db, room } = setup();
    expect(room.queue('black', ['done', ...blackPlacements(room.game.position, 1)])).toBe('invalidMove');
    expect(room.queue('black', ['e1e2'])).toBe('invalidMove');
    expect(room.queue('black', [...blackPlacements(room.game.position, 1), 'done'])).toBeNull();
    db.close();
  });
});

describe('rating trends', () => {
  it('add up the rating changes of recent rated games and keep the date of the last one', () => {
    let now = 1_000_000_000;
    const db = openDatabase(':memory:');
    const users = new Users(db, () => now);
    const games = new Games(db, users, { now: () => now, abortAfterMs: 60_000, claimAfterMs: 30_000, broadcast: () => {} });
    const [white, black] = [users.create('Kite', 'x')!, users.create('Knov', 'x')!];
    const room = games.create({
      mode: 'intro',
      rated: true,
      timeControl: { initial: 600, increment: 0 },
      daysPerMove: null,
      freeDraft: false,
      players: { white: { sessionId: 'w', userId: white.id, name: white.name }, black: { sessionId: 'b', userId: black.id, name: black.name } },
    });
    for (let i = 0; i < 2; i++) {
      const move = legalMoves(room.game.position)[0]!;
      expect(room.move(room.game.position.turn, moveToString(move), room.plies)).toBeNull();
    }
    room.resign('black');
    const [whiteDiff, blackDiff] = [room.seats.white.ratingDiff!, room.seats.black.ratingDiff!];
    expect(whiteDiff).toBeGreaterThan(0);
    expect(games.history.ratingTrends('intro', [white.id, black.id], now - 1000)).toEqual(new Map([[white.id, whiteDiff], [black.id, blackDiff]]));
    // Outside the period, and in another mode, nothing moved.
    expect(games.history.ratingTrends('intro', [white.id], now + 1000).get(white.id)).toBe(0);
    expect(games.history.ratingTrends('advanced', [white.id], 0).get(white.id)).toBe(0);
    const playedAt = (db.prepare("select played_at from ratings where user_id = ? and mode = 'intro'").get(white.id) as { played_at: number }).played_at;
    expect(playedAt).toBe(now);
    // A voided game gives the points back but does not count as playing.
    now += 5000;
    games.voidGame(room.id);
    expect((db.prepare("select played_at from ratings where user_id = ? and mode = 'intro'").get(white.id) as { played_at: number }).played_at).toBe(playedAt);
    db.close();
  });
});

describe('byo-yomi games', () => {
  it('keep their clock when the server restarts, and offer no extra time', () => {
    const db = openDatabase(':memory:');
    const users = new Users(db, Date.now);
    const options = { now: Date.now, abortAfterMs: 60_000, claimAfterMs: 30_000, broadcast: () => {} };
    const games = new Games(db, users, options);
    const timeControl = { initial: 0, increment: 0, byoyomi: 30, periods: 3 };
    const room = games.create({
      mode: 'advanced',
      rated: true,
      timeControl,
      daysPerMove: null,
      freeDraft: false,
      players: { white: { sessionId: 'w', userId: null, name: 'White' }, black: { sessionId: 'b', userId: null, name: 'Black' } },
    });
    for (let i = 0; i < 2; i++) {
      const move = legalMoves(room.game.position).find((m) => m.kind === 'drop')!;
      expect(room.move(room.game.position.turn, moveToString(move), room.plies)).toBeNull();
    }
    expect(room.view('w', null)).toMatchObject({ timeControl, canGiveTime: false });
    const restored = new Games(db, users, options).get(room.id)!;
    expect(restored.timeControl).toEqual(timeControl);
    expect(restored.view('w', null).clock?.white).toBeLessThanOrEqual(90_000);
    db.close();
  });
});

describe('finished game summaries', () => {
  it('are read from the stored row the same as from a rebuilt room, without replaying the game', () => {
    const db = openDatabase(':memory:');
    const users = new Users(db, Date.now);
    const options = { now: Date.now, abortAfterMs: 60_000, claimAfterMs: 30_000, broadcast: () => {} };
    const games = new Games(db, users, options);
    const room = games.create({
      mode: 'beginner',
      rated: false,
      timeControl: { initial: 300, increment: 3 },
      daysPerMove: null,
      freeDraft: false,
      players: { white: { sessionId: 'w', userId: null, name: 'White' }, black: { sessionId: 'b', userId: null, name: 'Black' } },
    });
    for (let i = 0; i < 6; i++) {
      const move = legalMoves(room.game.position).find((m) => m.kind === 'move')!;
      expect(room.move(room.game.position.turn, moveToString(move), room.plies)).toBeNull();
    }
    room.resign('black');
    const expected = room.summary();
    // A new store holds no finished room in memory, so the summary comes from the row.
    const fresh = new Games(db, users, options);
    expect(fresh.history.recentlyFinished(1)).toEqual([expected]);
    expect(fresh.cachedCount).toBe(0);
    db.close();
  });
});

describe('tv channels', () => {
  it('shows the strongest game, keeps it while it is played and moves on a few seconds after it ends', () => {
    let now = 1_000_000;
    const db = openDatabase(':memory:');
    const users = new Users(db, () => now);
    const games = new Games(db, users, { now: () => now, abortAfterMs: 60_000, claimAfterMs: 30_000, broadcast: () => {} });
    const tv = new Tv(games, () => now);
    const start = (mode: 'intro' | 'advanced', white: Player, black: Player) => {
      const room = games.create({ mode, rated: false, timeControl: null, daysPerMove: null, freeDraft: false, players: { white, black } });
      // One move each, so resigning ends the game instead of aborting it.
      for (const [ply, color] of (['white', 'black'] as const).entries()) {
        expect(room.move(color, moveToString(legalMoves(room.game.position)[0]!), ply)).toBeNull();
      }
      return room;
    };
    const channel = (name: string) => tv.channels().find((view) => view.channel === name)!.game?.id ?? null;

    expect(tv.channels().every((view) => view.game === null)).toBe(true);
    // Guests count as 1200, so two accounts at the default 1500 make the stronger game.
    const guests = start('intro', { sessionId: 'g1', userId: null, name: 'Gon' }, { sessionId: 'g2', userId: null, name: 'Killua' });
    expect(channel('best')).toBe(guests.id);
    expect(channel('intro')).toBe(guests.id);
    expect(channel('advanced')).toBeNull();

    const [white, black] = [users.create('Netero', 'x')!, users.create('Meruem', 'x')!];
    const strong = start('advanced', { sessionId: 'w', userId: white.id, name: white.name }, { sessionId: 'b', userId: black.id, name: black.name });
    expect(tv.live().map((room) => room.id)).toEqual([strong.id, guests.id]);
    expect(channel('best')).toBe(guests.id);
    expect(channel('advanced')).toBe(strong.id);

    guests.resign('black');
    now += TV_LINGER_MS - 1;
    expect(channel('best')).toBe(guests.id);
    expect(channel('intro')).toBe(guests.id);
    now += 1;
    expect(channel('best')).toBe(strong.id);
    expect(channel('intro')).toBeNull();
    db.close();
  });
});

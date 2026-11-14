import { describe, expect, it } from 'vitest';
import { Clock } from '../src/clock.ts';
import { openDatabase } from '../src/db.ts';
import { Games } from '../src/games.ts';
import { legalMoves, moveToString } from '@ligungi/engine';
import { DEFAULT_RATING, updateRating } from '../src/glicko.ts';
import { base32Decode, base32Encode, hotp, matchStep, newRecoveryCodes, normalizeCode, otpauthUri, TOTP_STEP_MS } from '../src/totp.ts';
import { TwoFactor } from '../src/two-factor.ts';
import { Users } from '../src/users.ts';

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
      firstPlayer: 'white',
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

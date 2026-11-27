import {
  Game,
  INITIAL_DRAFT_FEN,
  ROLES,
  applyMove,
  emptyBoard,
  emptyHand,
  fileOf,
  fromRulebook,
  handSize,
  initialPosition,
  legalMoves,
  moveToString,
  parseFen,
  rankOf,
  squareName,
  toFen,
  type Move,
  type Position,
  type Square,
} from '@ligungi/engine';
import {
  ADVANCED_POSITION,
  MODE_ADVANCED,
  NUM_PIECE_TYPES,
  applyMove as applyKomugiMove,
  boardFromFen,
  boardToFen,
  buildSan,
  canonicalFen,
  canonicalMove,
  generateRecords,
  parsePosition,
  rootGame,
} from '@komugi-ai/engine/rules';
import { describe, expect, it } from 'vitest';
import {
  KOMUGI_RULES,
  KomugiBridgeError,
  fromKomugiSquare,
  komugiFen,
  komugiPlays,
  komugiReplyMapper,
  komugiReplyToLigungi,
  komugiSearchInput,
  pendingDone,
  toKomugiSquare,
  type KomugiPosition,
} from '../../src/komugi/bridge.ts';

// An oracle written apart from the bridge (a port of the Node translator that ran the rules-parity matches).
const komugiSquareName = (square: Square): string => `${9 - rankOf(square)}-${9 - fileOf(square)}`;

const canonical = (move: Exclude<Move, { kind: 'done' }>, done = false): string => {
  const betray = move.betray?.length ? `^${[...move.betray].map((level) => level + 1).sort().join('')}` : '';
  const to = komugiSquareName(move.to);
  if (move.kind === 'drop') return `D:${move.role}@${to}${betray}${done ? '+done' : ''}`;
  return `M:${komugiSquareName(move.from)}>${to}:${move.action}${betray}`;
};

/**
 * ligungi's legal moves written as Komugi moves. A draft placement that leaves pieces in hand is
 * also Komugi's "place and finish" once the Marshal is placed; the last piece always finishes. The
 * stand-alone `done` has no Komugi move.
 */
const ligungiCanonicalSet = (position: Position, legal: readonly Move[] = legalMoves(position)): string[] => {
  const out: string[] = [];
  for (const move of legal) {
    if (move.kind === 'done') continue;
    if (position.phase === 'draft' && move.kind === 'drop') {
      const hand = position.hands[position.turn];
      if (handSize(hand) === 1) out.push(canonical(move, true));
      else {
        out.push(canonical(move));
        if (hand.marshal - (move.role === 'marshal' ? 1 : 0) === 0) out.push(canonical(move, true));
      }
      continue;
    }
    out.push(canonical(move));
  }
  return out.sort();
};

const komugiCanonicalSet = (position: KomugiPosition): string[] =>
  [...new Set(generateRecords(boardFromFen(komugiFen(position)), KOMUGI_RULES).map((record) => canonicalMove(record.struct)))].sort();

/** The ligungi position of a Komugi FEN, also written apart from the bridge (Advanced only). */
const positionFromKomugiFen = (fen: string): Position => {
  const plain = parsePosition(fen);
  if (plain.mode !== MODE_ADVANCED) throw new Error(`not an Advanced Komugi FEN: ${fen}`);
  const color = (index: number) => (index === 0 ? ('white' as const) : ('black' as const));
  const role = (index: number) => ROLES[index] ?? expect.unreachable(`piece type ${index}`);
  const board = emptyBoard();
  plain.cells.forEach((row, rank) =>
    row.forEach((tower, file) => {
      // Komugi rank 0 is Black's back rank (ligungi rank 9), file 0 is White's right (ligungi file i).
      board[(8 - rank) * 9 + (8 - file)] = tower.map((piece) => ({ role: role(piece.piece), color: color(piece.color) }));
    }),
  );
  const hands = { white: emptyHand(), black: emptyHand() };
  for (const entry of plain.hand) hands[color(entry.color)][role(entry.piece)] = entry.count;
  const drafting = plain.drafting.w || plain.drafting.b;
  return {
    mode: 'advanced',
    phase: drafting ? 'draft' : 'play',
    board,
    hands,
    turn: color(plain.turn),
    firstPlayer: 'white',
    freeDraft: false,
    draftDone: drafting ? { white: !plain.drafting.w, black: !plain.drafting.b } : { white: true, black: true },
  };
};

const advanced = (fen: string): KomugiPosition => {
  const position = parseFen(fen);
  if (!komugiPlays(position)) throw new Error(`not a Komugi position: ${fen}`);
  return position;
};

const start = (): KomugiPosition => advanced(INITIAL_DRAFT_FEN);

const moveNumberOf = (fen: string): number => Number(fen.split(' ')[5]);

const expectFenRoundTrips = (kfen: string, lfen: string): void => {
  expect(toFen(positionFromKomugiFen(kfen)), 'Komugi FEN -> ligungi FEN').toBe(lfen);
  expect(komugiFen(advanced(lfen), moveNumberOf(kfen)), 'ligungi FEN -> Komugi FEN').toBe(kfen);
  expect(toFen(positionFromKomugiFen(komugiFen(advanced(lfen)))), 'L -> K -> L').toBe(lfen);
};

/** The Komugi move with this canonical text in the position, as an action id. */
const komugiAction = (position: KomugiPosition, text: string): number => {
  const record = generateRecords(boardFromFen(komugiFen(position)), KOMUGI_RULES).find((r) => canonicalMove(r.struct) === text);
  if (!record) throw new Error(`Komugi has no ${text}`);
  return record.id;
};

const playAll = (position: Position, moves: readonly Move[]): Position => moves.reduce(applyMove, position);

const expectBridgeError = (run: () => unknown, code: KomugiBridgeError['code']): void => {
  let error: unknown;
  try {
    run();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(KomugiBridgeError);
  expect(error instanceof KomugiBridgeError ? error.code : error).toBe(code);
};

/** mulberry32, as in the parity harness. */
const makeRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('komugi bridge', () => {
  it('shares the piece table with Komugi', () => {
    expect(ROLES.length).toBe(NUM_PIECE_TYPES);
  });

  it('maps squares: Komugi rank-file, ligungi squares and the rulebook', () => {
    // White's Marshal home: Komugi 9-5 = rulebook column 5 row 9 = ligungi e1.
    expect(squareName(fromKomugiSquare(8, 4))).toBe('e1');
    expect(squareName(fromKomugiSquare(0, 4))).toBe('e9');
    expect(squareName(fromKomugiSquare(8, 8))).toBe('a1');
    expect(squareName(fromKomugiSquare(0, 0))).toBe('i9');
    expect(fromKomugiSquare(8, 8)).toBe(fromRulebook(9, 9));
    expect(fromKomugiSquare(6, 3)).toBe(fromRulebook(4, 7));
    for (let square = 0; square < 81; square++) {
      const [rank, file] = toKomugiSquare(square);
      expect(fromKomugiSquare(rank, file)).toBe(square);
    }
  });

  it('round-trips the start of the draft', () => {
    expectFenRoundTrips(ADVANCED_POSITION, INITIAL_DRAFT_FEN);
    expect(komugiFen(start())).toBe(ADVANCED_POSITION);
    expect(ligungiCanonicalSet(start())).toEqual(komugiCanonicalSet(start()));
  });

  it('round-trips stacked towers of both colors, both ways', () => {
    const kfens = [
      'r2|t:n|1ms2/j2jc|a:k||a:r|2/4f1ddf/2w6/R5w1n/9/2|N:g|n2R2/J6WN/3M3WS F2D4C1A2K1T1/s1d2 w 3 - 32',
      'm|r:r||n:f|1f1|d:t|Wd/1NR1d4/k1|i:G|wj|d:w|3/6n2/9/4F4/7|K:I|F/J2|J:N|C|A:S||A:D|2/R2T1MS2 W1N1D3/- b 3 - 33',
      'dc1dw1|k:r|2/d|i:n:s|2t1j1|r:f|/3|a:s:f|1g3/1d2n2m1/1a7/4R4/|N:W|FR|T:W|1|N:I||C:D:M|2/3|D:D||F:J|1|S:D|1A/3|K:S||J:A|4 -/- w 3 - 43',
    ];
    for (const kfen of kfens) expectFenRoundTrips(kfen, toFen(positionFromKomugiFen(kfen)));
    // A 3-tier tower with an enemy piece in the middle.
    const lfen = '4m4/9/9/9/4(PgN)4/9/9/9/4M4 w 2N4p advanced p w';
    expect(komugiFen(advanced(lfen), 30)).toBe('4m4/9/9/9/4|D:g:N|4/9/9/9/4M4 N2/d4 w 3 - 30');
    expectFenRoundTrips('4m4/9/9/9/4|D:g:N|4/9/9/9/4M4 N2/d4 w 3 - 30', lfen);
  });

  it('rejects what Komugi does not play', () => {
    for (const position of [
      initialPosition('intro'),
      initialPosition('beginner'),
      initialPosition('intermediate'),
      initialPosition('advanced', 'black'),
      initialPosition('advanced', 'white', { freeDraft: true }),
    ]) {
      expect(komugiPlays(position)).toBe(false);
      // The types refuse a plain Position; the checks hold at run time too.
      // @ts-expect-error not a KomugiPosition
      expectBridgeError(() => komugiFen(position), 'unsupported-position');
      // @ts-expect-error not a KomugiPosition
      expectBridgeError(() => komugiSearchInput(position, []), 'unsupported-position');
      // @ts-expect-error not a KomugiPosition
      expectBridgeError(() => komugiReplyMapper(position), 'unsupported-position');
    }
  });

  it('plays 終 as a placement then done when the opponent is done, and defers done otherwise', () => {
    let position: Position = start();
    const moves: Move[] = [];
    const play = (list: readonly Move[]): void => {
      for (const move of list) {
        expect(legalMoves(position).map(moveToString)).toContain(moveToString(move));
        moves.push(move);
        position = applyMove(position, move);
      }
    };
    const reply = (text: string) => {
      const current = advanced(toFen(position));
      return komugiReplyToLigungi(current, { action: komugiAction(current, text) });
    };

    // White places the Marshal with 終: Black still drafts, so White's done waits for White's next turn.
    const first = reply('D:marshal@9-5+done');
    expect(first.moves.map(moveToString)).toEqual(['M*e1']);
    expect(first.doneNextTurn).toBe(true);
    play(first.moves);
    expect(position.turn).toBe('black');
    expect(pendingDone(position, 'white')).toBeNull();
    play([{ kind: 'drop', role: 'marshal', to: fromKomugiSquare(0, 4) }]);
    const owed = pendingDone(position, 'white');
    expect(owed).toEqual({ kind: 'done' });
    play([owed!]);
    expect(position.draftDone).toEqual({ white: true, black: false });

    // Black places on: White is done, so Black's 終 is a placement then done, in one turn.
    const plain = reply('D:soldier@3-5');
    expect(plain).toEqual({ moves: [{ kind: 'drop', role: 'soldier', to: fromKomugiSquare(2, 4) }], doneNextTurn: false });
    play(plain.moves);
    const last = reply('D:soldier@3-4+done');
    expect(last.moves.map(moveToString)).toEqual(['P*f7', 'done']);
    expect(last.doneNextTurn).toBe(false);
    play(last.moves);
    expect(position.phase).toBe('play');
    expect(position.turn).toBe('white');

    // White's stand-alone done folds into its last placement: the history replays in Komugi.
    const input = komugiSearchInput(advanced(toFen(position)), moves);
    expect(input.history).toEqual(['新帥(9-5-1)終', '新帥(1-5-1)', '新兵(3-5-1)', '新兵(3-4-1)終']);
    expect(rootGame(input.fen, input.history, undefined, KOMUGI_RULES).stamp).toBe('present');
    expect(input.fen.split(' ')[4]).toBe('-');
  });

  it('gives no history when Black ends the draft right after a White placement', () => {
    const marshal = (column: number, row: number): Move => ({ kind: 'drop', role: 'marshal', to: fromRulebook(column, row) });
    const soldier = (column: number, row: number): Move => ({ kind: 'drop', role: 'soldier', to: fromRulebook(column, row) });
    const opening = [marshal(5, 9), marshal(5, 1), soldier(5, 7)];

    // Komugi's 終 for Black while White drafts cannot end the draft in the same turn.
    const before = advanced(toFen(playAll(start(), opening)));
    const reply = komugiReplyToLigungi(before, { action: komugiAction(before, 'D:soldier@3-5+done') });
    expect(reply).toEqual({ moves: [soldier(5, 3)], doneNextTurn: true });

    // White places again, then Black's done ends the draft: White has one more piece than gungi.js allows.
    const longer = [...opening, soldier(5, 3), soldier(4, 7), { kind: 'done' } as const];
    const endedAhead = advanced(toFen(playAll(start(), longer)));
    expect(endedAhead.phase).toBe('play');
    expect(komugiSearchInput(endedAhead, longer)).toEqual({ fen: komugiFen(endedAhead), history: null });

    // White declaring done instead keeps the game expressible.
    const even = [...opening, soldier(5, 3), { kind: 'done' } as const, { kind: 'done' } as const];
    const endedEven = advanced(toFen(playAll(start(), even)));
    expect(endedEven.phase).toBe('play');
    const input = komugiSearchInput(endedEven, even);
    expect(input.history).toEqual(['新帥(9-5-1)', '新帥(1-5-1)', '新兵(7-5-1)終', '新兵(3-5-1)終']);
    expect(rootGame(input.fen, input.history, undefined, KOMUGI_RULES).stamp).toBe('present');
  });

  it('finishes with the last piece in hand in both engines', () => {
    const position = advanced('9/9/9/9/9/9/9/9/4M4 w Pmgl2j2s3n2r2y2f4pc2akt advanced d w');
    const komugi = komugiCanonicalSet(position);
    expect(komugi.length).toBeGreaterThan(0);
    expect(komugi.every((text) => text.endsWith('+done'))).toBe(true);
    expect(ligungiCanonicalSet(position)).toEqual(komugi);
    const reply = komugiReplyToLigungi(position, { action: komugiAction(position, komugi[0]!) });
    expect(reply.moves).toHaveLength(1);
    expect(reply.doneNextTurn).toBe(false);
    expect(applyMove(position, reply.moves[0]!).draftDone.white).toBe(true);
  });

  it('maps betrayals, on the board and from the hand', () => {
    // A Tactician on a tower next to one and two Black Soldiers, two Soldiers in hand; then a Tactician dropped on a White-topped tower over a Black Soldier.
    for (const fen of ['4m4/9/9/9/3(pp)1p3/4(PT)4/9/9/4M4 w 2P advanced p w', '4m4/9/9/9/9/9/2(pS)6/9/4M4 w PT advanced p w']) {
      const position = advanced(fen);
      const komugi = komugiCanonicalSet(position);
      expect(ligungiCanonicalSet(position)).toEqual(komugi);
      const betrayals = komugi.filter((text) => text.includes('^'));
      expect(betrayals.length, fen).toBeGreaterThan(0);
      for (const text of betrayals) {
        const { moves } = komugiReplyToLigungi(position, { action: komugiAction(position, text) });
        const [move] = moves;
        expect(moves).toHaveLength(1);
        expect(move && move.kind !== 'done' ? canonical(move) : undefined).toBe(text);
        expect(legalMoves(position).map(moveToString)).toContain(move && moveToString(move));
      }
    }
    expect(komugiCanonicalSet(advanced('4m4/9/9/9/3(pp)1p3/4(PT)4/9/9/4M4 w 2P advanced p w'))).toContain('M:6-5>5-6:stack^12');
  });

  it('checks the moves it is given and the replies it maps', () => {
    const opening: Move[] = [
      { kind: 'drop', role: 'marshal', to: fromRulebook(5, 9) },
      { kind: 'drop', role: 'marshal', to: fromRulebook(5, 1) },
    ];
    const position = advanced(toFen(playAll(start(), opening)));
    expectBridgeError(() => komugiSearchInput(position, opening.slice(0, 1)), 'history-mismatch');
    expect(komugiSearchInput(position).history).toBeNull();

    const map = komugiReplyMapper(position);
    const action = komugiAction(position, 'D:soldier@7-5');
    const san = '新兵(7-5-1)';
    expect(map({ san })).toEqual(map({ action }));
    expect(map({ action, san })).toEqual(map({ action }));
    expectBridgeError(() => map({ action, san: '新兵(7-4-1)' }), 'unknown-reply');
    expectBridgeError(() => map({ san: '新帥(7-5-1)' }), 'unknown-reply');
    expectBridgeError(() => map({ action: -1 }), 'illegal-reply');
    // An action id names a move but not a side: this one is a soldier drop on 3-5, in Black's camp, so White cannot play it.
    const blackToMove = advanced(toFen(playAll(position, map({ action }).moves)));
    expectBridgeError(() => map({ action: komugiAction(blackToMove, 'D:soldier@3-5') }), 'illegal-reply');
  });

  it('agrees with Komugi along seeded random Advanced games', () => {
    const GAMES = 20;
    const MAX_PLIES = 80;
    const seen = { play: 0, deferredDone: 0, placeThenDone: 0, history: 0, noHistory: 0 };

    for (let game = 0; game < GAMES; game++) {
      const random = makeRandom(20261121 + game);
      // Each side declares done after a random number of placements; every fifth game nobody does.
      const doneAfter = { white: 8 + Math.floor(random() * 17), black: 8 + Math.floor(random() * 17) };
      const neverDone = game % 5 === 4;
      const record = new Game(start());
      const moves: Move[] = [];
      const draftPlaced = { white: 0, black: 0 };

      // Komugi's history, checked by Komugi's own replay. gungi.js cannot end a draft with White a piece ahead.
      const checkHistory = (where: string): void => {
        const position = advanced(toFen(record.position));
        const input = komugiSearchInput(position, moves);
        expect(toFen(positionFromKomugiFen(input.fen)), where).toBe(toFen(position));
        const expressible = position.phase === 'draft' || draftPlaced.white <= draftPlaced.black;
        expect(input.history !== null, where).toBe(expressible);
        if (input.history === null) seen.noHistory++;
        else {
          seen.history++;
          expect(rootGame(input.fen, input.history, undefined, KOMUGI_RULES).stamp, where).toBe('present');
        }
      };

      for (let ply = 0; ply < MAX_PLIES && !record.outcome; ply++) {
        const position = advanced(toFen(record.position));
        const legal = record.legalMoves();
        const where = `game ${game} ply ${ply} ${toFen(position)}`;
        if (position.phase === 'play') seen.play++;

        const kfen = komugiFen(position);
        expect(canonicalFen(kfen), where).toBe(kfen);
        expect(toFen(positionFromKomugiFen(kfen)), where).toBe(toFen(position));

        const board = boardFromFen(kfen);
        const records = generateRecords(board, KOMUGI_RULES);
        const ligungiSet = new Set(ligungiCanonicalSet(position, legal));
        const komugiSet = new Set(records.map((r) => canonicalMove(r.struct)));
        const onlyLigungi = [...ligungiSet].filter((text) => !komugiSet.has(text));
        const onlyKomugi = [...komugiSet].filter((text) => !ligungiSet.has(text));
        if (onlyLigungi.length > 0 || onlyKomugi.length > 0) expect({ onlyLigungi, onlyKomugi }, where).toEqual({ onlyLigungi: [], onlyKomugi: [] });

        // Every Komugi move maps to legal ligungi moves with the same meaning (failures collected, one assertion per position).
        const legalSet = new Set(legal);
        const bySan = ply % 10 === 0;
        const map = komugiReplyMapper(position, legal);
        const wrong: string[] = [];
        let doneChecked = false;
        for (const { id, struct } of records) {
          const text = canonicalMove(struct);
          // Every tenth position also by SAN, as the worker replies with both.
          const reply = map(bySan ? { action: id, san: buildSan(board, struct) } : { action: id });
          const [first, second, ...rest] = reply.moves;
          if (first === undefined || first.kind === 'done' || !legalSet.has(first) || rest.length > 0) wrong.push(`${text}: not a legal move`);
          else if (canonical(first, text.endsWith('+done')) !== text) wrong.push(`${text}: ${moveToString(first)}`);
          if (reply.doneNextTurn) seen.deferredDone++;
          if (second === undefined) continue;
          seen.placeThenDone++;
          if (second.kind !== 'done' || reply.doneNextTurn) wrong.push(`${text}: ${moveToString(second)} after the placement`);
          // The bridge checks every done itself; check one per position independently.
          if (doneChecked || !first || first.kind === 'done') continue;
          doneChecked = true;
          const after = applyMove(position, first);
          if (after.turn !== position.turn || !legalMoves(after).some((move) => move.kind === 'done')) wrong.push(`${text}: done not legal`);
        }
        expect(wrong, where).toEqual([]);

        const placed = 25 - handSize(position.hands[position.turn]);
        const done = legal.find((move) => move.kind === 'done');
        const move = done && !neverDone && placed >= doneAfter[position.turn] ? done : legal[Math.floor(random() * legal.length)]!;

        // Both engines reach the same position (a stand-alone done has no Komugi move).
        const next = applyMove(position, move);
        if (move.kind !== 'done') {
          const text = canonical(move, position.phase === 'draft' && handSize(position.hands[position.turn]) === 1);
          const found = records.find((r) => canonicalMove(r.struct) === text);
          expect(found, `${where} ${text}`).toBeDefined();
          const after = board.copy();
          applyKomugiMove(after, found!.struct);
          expect(toFen(positionFromKomugiFen(boardToFen(after))), `${where} ${text}`).toBe(toFen(next));
          if (position.phase === 'draft') draftPlaced[position.turn]++;
        }
        record.play(move);
        moves.push(move);
        if (ply === 9 || (position.phase === 'draft' && next.phase === 'play')) checkHistory(where);
      }
      checkHistory(`game ${game} end`);
    }

    expect(seen.play).toBeGreaterThan(800);
    expect(seen.deferredDone).toBeGreaterThan(0);
    expect(seen.placeThenDone).toBeGreaterThan(0);
    expect(seen.history).toBeGreaterThan(GAMES);
    expect(seen.noHistory).toBeGreaterThan(0);
  }, 60_000);
});

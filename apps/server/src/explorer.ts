import { applyMove, initialPosition, parseMove, toFen, type Color } from '@ligungi/engine';
import type { ExplorerBand, ExplorerMode, ExplorerStats, ExplorerView } from '@ligungi/protocol';
import type { Db } from './db.ts';

/** The statistics are rebuilt from the stored games at most this often. */
export const EXPLORER_REFRESH_MS = 10 * 60_000;

const BAND_RANGES: Readonly<Record<ExplorerBand, readonly [number, number]>> = {
  all: [-Infinity, Infinity],
  below1400: [-Infinity, 1400],
  '1400to1700': [1400, 1700],
  from1700: [1700, Infinity],
};

interface Tally {
  games: number;
  white: number;
  draws: number;
  black: number;
  ratingSum: number;
  ratingCount: number;
}

interface Index {
  readonly at: number;
  readonly totals: Map<string, Tally>;
  readonly moves: Map<string, Map<string, Tally>>;
}

interface GameRow {
  moves: string;
  winner: Color | null;
  white_rating: number | null;
  black_rating: number | null;
}

const empty = (): Tally => ({ games: 0, white: 0, draws: 0, black: 0, ratingSum: 0, ratingCount: 0 });

const view = (tally: Tally | undefined): ExplorerStats => ({
  games: tally?.games ?? 0,
  white: tally?.white ?? 0,
  draws: tally?.draws ?? 0,
  black: tally?.black ?? 0,
  rating: tally && tally.ratingCount > 0 ? Math.round(tally.ratingSum / tally.ratingCount) : null,
});

/**
 * Draft statistics from the finished games: for every draft position reached, how the games ended and which pieces
 * were placed next. Positions, not move orders, are counted, so drafts that reach the same setup add up. Voided games,
 * the free draft option (another rule for ending the draft) and games where Black moved first (from before White
 * always started, every one of their positions differs in the first player) are left out.
 */
export class DraftExplorer {
  readonly #db: Db;
  readonly #now: () => number;
  readonly #indexes = new Map<string, Index>();

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  #build(mode: ExplorerMode, band: ExplorerBand, rated: boolean): Index {
    const rows = this.#db
      .prepare(
        `select moves, winner, white_rating, black_rating from games
         where status = 'ended' and mode = ? and voided = 0 and free_draft = 0 and first_player = 'white' and (? = 0 or rated = 1)`,
      )
      .all(mode, rated ? 1 : 0) as unknown as GameRow[];
    const [low, high] = BAND_RANGES[band];
    const totals = new Map<string, Tally>();
    const moves = new Map<string, Map<string, Tally>>();
    const count = (tally: Tally, row: GameRow, ratings: number[]) => {
      tally.games++;
      if (row.winner === 'white') tally.white++;
      else if (row.winner === 'black') tally.black++;
      else tally.draws++;
      for (const rating of ratings) {
        tally.ratingSum += rating;
        tally.ratingCount++;
      }
    };
    for (const row of rows) {
      const ratings = [row.white_rating, row.black_rating].filter((rating): rating is number => rating !== null);
      if (band !== 'all') {
        // A band needs both players rated: an average with a guest would say little.
        if (ratings.length < 2) continue;
        const average = (ratings[0]! + ratings[1]!) / 2;
        if (average < low || average >= high) continue;
      }
      let position = initialPosition(mode);
      for (const text of row.moves ? row.moves.split(' ') : []) {
        if (position.phase !== 'draft') break;
        const move = parseMove(text);
        if (!move) break;
        const key = toFen(position);
        count((totals.get(key) ?? totals.set(key, empty()).get(key))!, row, ratings);
        const next = moves.get(key) ?? moves.set(key, new Map()).get(key)!;
        count((next.get(text) ?? next.set(text, empty()).get(text))!, row, ratings);
        position = applyMove(position, move);
      }
    }
    return { at: this.#now(), totals, moves };
  }

  query(mode: ExplorerMode, band: ExplorerBand, rated: boolean, fen: string | null): ExplorerView {
    const cacheKey = `${mode}|${band}|${rated}`;
    let index = this.#indexes.get(cacheKey);
    if (!index || this.#now() - index.at >= EXPLORER_REFRESH_MS) {
      index = this.#build(mode, band, rated);
      this.#indexes.set(cacheKey, index);
    }
    const key = fen ?? toFen(initialPosition(mode));
    const next = [...(index.moves.get(key) ?? new Map<string, Tally>()).entries()]
      .map(([move, tally]) => ({ move, ...view(tally) }))
      .sort((a, b) => b.games - a.games || a.move.localeCompare(b.move));
    return { fen: key, total: view(index.totals.get(key)), moves: next, updatedAt: index.at };
  }
}

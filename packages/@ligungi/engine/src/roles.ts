import type { Role } from './types.ts';

export interface RoleInfo {
  readonly kanji: string;
  readonly reading: string;
  readonly letter: string;
  readonly count: number;
}

export const ROLE_INFO: Readonly<Record<Role, RoleInfo>> = {
  marshal: { kanji: '帥', reading: 'sui', letter: 'M', count: 1 },
  general: { kanji: '大', reading: 'taishō', letter: 'G', count: 1 },
  lieutenant: { kanji: '中', reading: 'chūjō', letter: 'L', count: 1 },
  major: { kanji: '小', reading: 'shōshō', letter: 'J', count: 2 },
  samurai: { kanji: '侍', reading: 'samurai', letter: 'S', count: 2 },
  lancer: { kanji: '槍', reading: 'yari', letter: 'N', count: 3 },
  rider: { kanji: '馬', reading: 'kiba', letter: 'R', count: 2 },
  spy: { kanji: '忍', reading: 'shinobi', letter: 'Y', count: 2 },
  fortress: { kanji: '砦', reading: 'toride', letter: 'F', count: 2 },
  soldier: { kanji: '兵', reading: 'hyō', letter: 'P', count: 4 },
  cannon: { kanji: '砲', reading: 'ōzutsu', letter: 'C', count: 1 },
  archer: { kanji: '弓', reading: 'yumi', letter: 'A', count: 2 },
  musketeer: { kanji: '筒', reading: 'tsutsu', letter: 'K', count: 1 },
  tactician: { kanji: '謀', reading: 'bōshō', letter: 'T', count: 1 },
};

const LETTER_TO_ROLE = new Map<string, Role>(
  Object.entries(ROLE_INFO).map(([role, info]) => [info.letter, role as Role]),
);

export const roleFromLetter = (letter: string): Role | undefined =>
  LETTER_TO_ROLE.get(letter.toUpperCase());

/** Direction vectors from the mover's point of view: `dr > 0` is forward. */
type Vector = readonly [df: number, dr: number];

const N: Vector = [0, 1];
const S: Vector = [0, -1];
const E: Vector = [1, 0];
const W: Vector = [-1, 0];
const NE: Vector = [1, 1];
const NW: Vector = [-1, 1];
const SE: Vector = [1, -1];
const SW: Vector = [-1, -1];
const ORTHOGONAL = [N, S, E, W] as const;
const DIAGONAL = [NE, NW, SE, SW] as const;

/**
 * - `slide`: any distance up to `base + tier - 1` (or the board edge when `base` is Infinity),
 *   blocked by any piece on the way.
 * - `jump`: lands at distance `min..base + tier - 1`, passing over towers no taller than the mover.
 * - `volley`: the archer's forward-diagonal shots, landing on `(±k, k + 1)` for `k = 1..tier`.
 */
export type MoveRule =
  | { readonly type: 'slide'; readonly dir: Vector; readonly base: number }
  | { readonly type: 'jump'; readonly dir: Vector; readonly min: number; readonly base: number }
  | { readonly type: 'volley' };

const slides = (dirs: readonly Vector[], base: number): MoveRule[] =>
  dirs.map((dir) => ({ type: 'slide', dir, base }));

export const MOVE_RULES: Readonly<Record<Role, readonly MoveRule[]>> = {
  marshal: slides([...ORTHOGONAL, ...DIAGONAL], 1),
  general: [...slides(ORTHOGONAL, Infinity), ...slides(DIAGONAL, 1)],
  lieutenant: [...slides(DIAGONAL, Infinity), ...slides(ORTHOGONAL, 1)],
  major: slides([N, NE, NW, E, W, S], 1),
  samurai: slides([N, NE, NW, S], 1),
  lancer: [...slides([N], 2), ...slides([NE, NW, S], 1)],
  rider: [...slides([N, S], 2), ...slides([E, W], 1)],
  spy: slides(DIAGONAL, 2),
  fortress: slides([N, E, W, SE, SW], 1),
  soldier: slides([N, S], 1),
  tactician: slides([NE, NW, S], 1),
  cannon: [{ type: 'jump', dir: N, min: 3, base: 3 }, ...slides([E, W, S], 1)],
  musketeer: [{ type: 'jump', dir: N, min: 2, base: 2 }, ...slides([SE, SW], 1)],
  archer: [{ type: 'jump', dir: N, min: 2, base: 2 }, { type: 'volley' }, ...slides([S], 1)],
};

/**
 * Cells strictly crossed by the straight segment between the centers of (0, 0) and (dx, dy),
 * excluding both ends. This is how far an archer's arrow is exposed to taller towers.
 */
export const crossedCells = (dx: number, dy: number): Array<readonly [number, number]> => {
  const interval = (cell: number, delta: number): [number, number] | undefined => {
    if (delta === 0) return Math.abs(cell) <= 0.5 ? [0, 1] : undefined;
    const a = (cell - 0.5) / delta;
    const b = (cell + 0.5) / delta;
    return [Math.min(a, b), Math.max(a, b)];
  };
  const cells: Array<readonly [number, number]> = [];
  for (let x = Math.min(0, dx); x <= Math.max(0, dx); x++) {
    for (let y = Math.min(0, dy); y <= Math.max(0, dy); y++) {
      if ((x === 0 && y === 0) || (x === dx && y === dy)) continue;
      const ix = interval(x, dx);
      const iy = interval(y, dy);
      if (!ix || !iy) continue;
      const start = Math.max(ix[0], iy[0], 0);
      const end = Math.min(ix[1], iy[1], 1);
      if (end - start > 1e-9) cells.push([x, y]);
    }
  }
  return cells;
};

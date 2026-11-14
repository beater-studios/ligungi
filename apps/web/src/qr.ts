/**
 * A QR code encoder for short texts (ISO/IEC 18004): byte mode, error correction level M, versions 1 to 10 (up to 213
 * bytes), enough for the otpauth links of two-factor setup. Written here so the site needs no dependency for it.
 */

/** Per version (index 1 to 10): error correction codewords per block, then the data codewords of each block. */
const BLOCKS: ReadonlyArray<readonly [number, readonly number[]]> = [
  [0, []],
  [10, [16]],
  [16, [28]],
  [26, [44]],
  [18, [32, 32]],
  [24, [43, 43]],
  [16, [27, 27, 27, 27]],
  [18, [31, 31, 31, 31]],
  [22, [38, 38, 39, 39]],
  [22, [36, 36, 36, 37, 37]],
  [26, [43, 43, 43, 43, 44]],
];

const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

export const QR_MAX_VERSION = 10;

const dataCapacity = (version: number): number => BLOCKS[version]![1].reduce((sum, n) => sum + n, 0);
const countBits = (version: number): number => (version < 10 ? 8 : 16);

/** Multiplication in GF(2^8) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1. */
const gfMultiply = (x: number, y: number): number => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
};

const rsDivisor = (degree: number): number[] => {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j]!, root);
      if (j + 1 < degree) result[j]! ^= result[j + 1]!;
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
};

const rsRemainder = (data: readonly number[], divisor: readonly number[]): number[] => {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coefficient, i) => (result[i]! ^= gfMultiply(coefficient, factor)));
  }
  return result;
};

/** The data bits (mode, length, bytes, terminator, padding) split into blocks and interleaved with their error correction. */
const codewords = (bytes: Uint8Array, version: number): number[] => {
  const capacity = dataCapacity(version) * 8;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) data.push(pad);

  const [ecLength, sizes] = BLOCKS[version]!;
  const divisor = rsDivisor(ecLength);
  const blocks: number[][] = [];
  let offset = 0;
  for (const size of sizes) {
    blocks.push(data.slice(offset, offset + size));
    offset += size;
  }
  const ecBlocks = blocks.map((block) => rsRemainder(block, divisor));
  const result: number[] = [];
  for (let i = 0; i < Math.max(...sizes); i++) for (const block of blocks) if (i < block.length) result.push(block[i]!);
  for (let i = 0; i < ecLength; i++) for (const block of ecBlocks) result.push(block[i]!);
  return result;
};

const MASKS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Grid {
  readonly size: number;
  readonly dark: boolean[][];
  readonly reserved: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }

  set(x: number, y: number, dark: boolean): void {
    this.dark[y]![x] = dark;
    this.reserved[y]![x] = true;
  }
}

const drawFunctionPatterns = (grid: Grid, version: number): void => {
  const { size } = grid;
  for (let i = 0; i < size; i++) {
    grid.set(6, i, i % 2 === 0);
    grid.set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) grid.set(x, y, distance !== 2 && distance !== 4);
      }
    }
  }
  const positions = ALIGNMENT[version]!;
  const last = positions.length - 1;
  positions.forEach((cy, i) =>
    positions.forEach((cx, j) => {
      // The corners taken by finder patterns get no alignment pattern.
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) grid.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  drawFormat(grid, 0);
  if (version >= 7) {
    let remainder = version;
    for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    const bits = (version << 12) | remainder;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      grid.set(a, b, dark);
      grid.set(b, a, dark);
    }
  }
};

/** Format information: level M (bits 00) and the mask, BCH coded, in both copies, plus the always dark module. */
const drawFormat = (grid: Grid, mask: number): void => {
  const { size } = grid;
  const data = mask;
  let remainder = data;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) grid.set(8, i, bit(i));
  grid.set(8, 7, bit(6));
  grid.set(8, 8, bit(7));
  grid.set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) grid.set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) grid.set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) grid.set(8, size - 15 + i, bit(i));
  grid.set(8, size - 8, true);
};

const drawData = (grid: Grid, data: readonly number[]): void => {
  const { size } = grid;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vertical = 0; vertical < size; vertical++) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (grid.reserved[y]![x] || i >= data.length * 8) continue;
        grid.dark[y]![x] = ((data[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
};

const applyMask = (grid: Grid, mask: number): void => {
  const test = MASKS[mask]!;
  for (let y = 0; y < grid.size; y++) for (let x = 0; x < grid.size; x++) if (!grid.reserved[y]![x] && test(x, y)) grid.dark[y]![x] = !grid.dark[y]![x];
};

/** The four penalty rules of the standard; the mask with the lowest score is the easiest to scan. */
const penalty = (dark: readonly (readonly boolean[])[]): number => {
  const size = dark.length;
  const at = (x: number, y: number, vertical: boolean) => (vertical ? dark[x]![y]! : dark[y]![x]!);
  let score = 0;
  const finder = [true, false, true, true, true, false, true];
  for (const vertical of [false, true]) {
    for (let y = 0; y < size; y++) {
      let run = 1;
      for (let x = 1; x <= size; x++) {
        if (x < size && at(x, y, vertical) === at(x - 1, y, vertical)) run++;
        else {
          if (run >= 5) score += 3 + run - 5;
          run = 1;
        }
      }
      for (let x = 0; x + 7 <= size; x++) {
        if (!finder.every((value, k) => at(x + k, y, vertical) === value)) continue;
        const light = (from: number) => from >= 0 && from + 4 <= size && [0, 1, 2, 3].every((k) => !at(from + k, y, vertical));
        if (light(x - 4) || light(x + 7)) score += 40;
      }
    }
  }
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const value = dark[y]![x];
      if (dark[y]![x + 1] === value && dark[y + 1]![x] === value && dark[y + 1]![x + 1] === value) score += 3;
    }
  }
  const total = size * size;
  const darkCount = dark.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs((darkCount * 100) / total - 50) / 5) * 10;
  return score;
};

/**
 * The modules of the QR code for `text` (rows of booleans, `true` is dark), without the quiet zone. `mask` forces a
 * mask pattern (0 to 7) instead of picking the best one.
 */
export const qrMatrix = (text: string, mask?: number): boolean[][] => {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= QR_MAX_VERSION && 4 + countBits(version) + bytes.length * 8 > dataCapacity(version) * 8) version++;
  if (version > QR_MAX_VERSION) throw new RangeError('Text too long for a QR code up to version 10');
  const data = codewords(bytes, version);
  const draw = (pattern: number): Grid => {
    const grid = new Grid(version * 4 + 17);
    drawFunctionPatterns(grid, version);
    drawData(grid, data);
    applyMask(grid, pattern);
    drawFormat(grid, pattern);
    return grid;
  };
  if (mask !== undefined) return draw(mask).dark;
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let pattern = 0; pattern < MASKS.length; pattern++) {
    const { dark } = draw(pattern);
    const score = penalty(dark);
    if (score < bestScore) {
      best = dark;
      bestScore = score;
    }
  }
  return best!;
};

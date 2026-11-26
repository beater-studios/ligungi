/**
 * The custom board theme: from the two colors a player picks (board and lines), the CSS variables the board package
 * reads under `gg-theme-custom`, with move marks chosen to stand out on that board, and warnings when the choice
 * would make the board hard to read.
 */

export interface CustomBoard {
  readonly board: string;
  readonly line: string;
}

/** The light wood theme, with its lines as a solid color. */
export const DEFAULT_CUSTOM_BOARD: CustomBoard = { board: '#e3c389', line: '#6e5636' };

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

type Rgb = readonly [number, number, number];

const parse = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;

const toHex = (rgb: Rgb): string => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** `a` moved toward `b` by `amount` (0 to 1), channel by channel. */
export const mixColors = (a: string, b: string, amount: number): string => {
  const [x, y] = [parse(a), parse(b)];
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * amount) as unknown as Rgb);
};

/** Relative luminance (WCAG 2). */
export const luminance = (hex: string): number => {
  const [r, g, b] = parse(hex).map(linear) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contrast ratio (WCAG 2), from 1 to 21. */
export const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
};

/** OKLab, where the distance between two colors follows how different they look. */
const oklab = (rgb: Rgb): Rgb => {
  const [r, g, b] = rgb.map(linear) as unknown as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const difference = (a: Rgb, b: Rgb): number => {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** A translucent mark as it shows over the board. */
const over = (board: Rgb, [r, g, b, alpha]: Rgba): Rgb => [
  board[0] + (r - board[0]) * alpha,
  board[1] + (g - board[1]) * alpha,
  board[2] + (b - board[2]) * alpha,
];

type Rgba = readonly [number, number, number, number];
const MARK_NAMES = ['last', 'selected', 'dest', 'dest-hover', 'capture', 'reach', 'reach-edge'] as const;
type Marks = Readonly<Record<(typeof MARK_NAMES)[number], Rgba>>;

/** The mark colors of the built-in themes: light wood, walnut and high contrast. */
const MARK_SETS: readonly Marks[] = [
  {
    last: [155, 199, 0, 0.38],
    selected: [20, 85, 30, 0.5],
    dest: [20, 85, 30, 0.55],
    'dest-hover': [20, 85, 30, 0.3],
    capture: [200, 45, 30, 0.65],
    reach: [214, 110, 40, 0.28],
    'reach-edge': [214, 110, 40, 0.55],
  },
  {
    last: [255, 225, 90, 0.6],
    selected: [170, 225, 110, 0.5],
    dest: [195, 240, 140, 0.8],
    'dest-hover': [170, 225, 110, 0.35],
    capture: [255, 150, 130, 0.85],
    reach: [255, 165, 80, 0.35],
    'reach-edge': [255, 180, 100, 0.9],
  },
  {
    last: [255, 200, 0, 0.65],
    selected: [0, 80, 230, 0.5],
    dest: [0, 60, 210, 0.9],
    'dest-hover': [0, 80, 230, 0.3],
    capture: [230, 110, 0, 0.95],
    reach: [0, 80, 230, 0.15],
    'reach-edge': [0, 60, 210, 0.9],
  },
];

/** How far the faintest of the marks that matter most (last move, selection, destinations) is from the board. */
const markVisibility = (board: Rgb, marks: Marks): number =>
  Math.min(...(['last', 'selected', 'dest'] as const).map((name) => difference(board, over(board, marks[name]))));

/** Marks this far from the board read comfortably; the light wood theme's own marks sit just above it. */
const GOOD_MARK_DIFFERENCE = 0.07;
/** Below this, the faintest mark is fainter than on any built-in theme. */
const MIN_MARK_DIFFERENCE = 0.06;
/** Boards darker than this get the dark wood theme's marks first. */
const DARK_BOARD = 0.25;
/** WCAG's minimum for graphics (lines, small text such as the coordinates). */
const MIN_LINE_CONTRAST = 3;
/** Piece faces need little contrast (they have a rim and a border), but must not melt into the board. */
const MIN_PIECE_CONTRAST = 1.2;
const WHITE_FACE = '#f6f1e7';
const BLACK_FACE = '#232323';

export type BoardWarning = 'lines' | 'whitePieces' | 'blackPieces' | 'marks';

export interface CustomBoardStyle {
  /** CSS custom properties (`--gg-custom-*`) for the page root. */
  readonly vars: Readonly<Record<string, string>>;
  readonly warnings: readonly BoardWarning[];
}

export const customBoardStyle = ({ board, line }: CustomBoard): CustomBoardStyle => {
  const surface = parse(board);
  // The marks players know from the wood themes come first, as long as they stand out; otherwise the clearest set.
  const order = luminance(board) < DARK_BOARD ? [1, 2, 0] : [0, 2, 1];
  const candidates = order.map((i) => ({ marks: MARK_SETS[i]!, visibility: markVisibility(surface, MARK_SETS[i]!) }));
  const best = candidates.find((candidate) => candidate.visibility >= GOOD_MARK_DIFFERENCE) ?? candidates.reduce((a, b) => (b.visibility > a.visibility ? b : a));
  const vars: Record<string, string> = {
    '--gg-custom-board': board,
    '--gg-custom-edge': toHex(surface.map((c) => c * 0.75) as unknown as Rgb),
    '--gg-custom-line': line,
  };
  for (const name of MARK_NAMES) vars[`--gg-custom-${name}`] = `rgba(${best.marks[name].join(', ')})`;
  const warnings: BoardWarning[] = [];
  if (contrast(board, line) < MIN_LINE_CONTRAST) warnings.push('lines');
  if (contrast(board, WHITE_FACE) < MIN_PIECE_CONTRAST) warnings.push('whitePieces');
  if (contrast(board, BLACK_FACE) < MIN_PIECE_CONTRAST) warnings.push('blackPieces');
  if (best.visibility < MIN_MARK_DIFFERENCE) warnings.push('marks');
  return { vars, warnings };
};

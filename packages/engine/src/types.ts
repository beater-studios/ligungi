export const COLORS = ['white', 'black'] as const;
export type Color = (typeof COLORS)[number];

export const ROLES = [
  'marshal',
  'general',
  'lieutenant',
  'major',
  'samurai',
  'lancer',
  'rider',
  'spy',
  'fortress',
  'soldier',
  'cannon',
  'archer',
  'musketeer',
  'tactician',
] as const;
export type Role = (typeof ROLES)[number];

export interface Piece {
  readonly role: Role;
  readonly color: Color;
}

/** Pieces from bottom to top. */
export type Tower = readonly Piece[];

/** 0..80, `rank * 9 + file`. File 0 is White's left, rank 0 is White's back rank. */
export type Square = number;

export type Hand = Readonly<Record<Role, number>>;

export const MODES = ['intro', 'beginner', 'intermediate', 'advanced'] as const;
export type Mode = (typeof MODES)[number];

export type Phase = 'draft' | 'play';

export interface Position {
  readonly mode: Mode;
  readonly phase: Phase;
  readonly board: readonly Tower[];
  readonly hands: Readonly<Record<Color, Hand>>;
  readonly turn: Color;
  /** Who places first in the draft and moves first in play. Independent of color (rulebook p.6). */
  readonly firstPlayer: Color;
  /**
   * Draft rule. `false` (rulebook): the draft ends as soon as the second player declares done.
   * `true` (platform option for casual games): it ends only when both players have declared done.
   */
  readonly freeDraft: boolean;
  readonly draftDone: Readonly<Record<Color, boolean>>;
}

export type BoardAction = 'move' | 'stack' | 'capture';

/**
 * `betray` lists the levels (0-based, bottom first) of the destination tower, as it was before the
 * tactician landed, whose enemy pieces are swapped for same-role pieces from the mover's hand.
 */
export type Move =
  | {
      readonly kind: 'move';
      readonly from: Square;
      readonly to: Square;
      readonly action: BoardAction;
      readonly betray?: readonly number[];
    }
  | {
      readonly kind: 'drop';
      readonly role: Role;
      readonly to: Square;
      readonly betray?: readonly number[];
    }
  | { readonly kind: 'done' };

export type Outcome =
  | { readonly winner: Color; readonly reason: 'capture' | 'mate' | 'resign' | 'timeout' | 'abandon' }
  | { readonly winner: null; readonly reason: 'repetition' | 'insufficient' | 'agreement' };

export const opposite = (color: Color): Color => (color === 'white' ? 'black' : 'white');

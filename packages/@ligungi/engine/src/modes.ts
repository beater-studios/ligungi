import type { Mode, Role } from './types.ts';

export interface ModeRules {
  readonly maxHeight: 2 | 3;
  readonly marshalStacks: boolean;
  readonly draft: boolean;
}

export const MODE_RULES: Readonly<Record<Mode, ModeRules>> = {
  intro: { maxHeight: 2, marshalStacks: false, draft: false },
  beginner: { maxHeight: 2, marshalStacks: false, draft: false },
  intermediate: { maxHeight: 2, marshalStacks: true, draft: true },
  advanced: { maxHeight: 3, marshalStacks: true, draft: true },
};

/** Rulebook coordinates `[column, row, role]` for White; Black mirrors them by 180° rotation. */
export type FixedLayout = readonly (readonly [number, number, Role])[];

const FRONT_ROW: FixedLayout = [
  [9, 7, 'soldier'],
  [7, 7, 'fortress'],
  [6, 7, 'samurai'],
  [5, 7, 'soldier'],
  [4, 7, 'samurai'],
  [3, 7, 'fortress'],
  [1, 7, 'soldier'],
];

const BACK_ROW: FixedLayout = [
  [6, 9, 'general'],
  [5, 9, 'marshal'],
  [4, 9, 'lieutenant'],
];

export interface FixedSetup {
  readonly layout: FixedLayout;
  readonly hand: Readonly<Partial<Record<Role, number>>>;
}

export const FIXED_SETUPS: Readonly<Partial<Record<Mode, FixedSetup>>> = {
  intro: {
    layout: [
      ...FRONT_ROW,
      [8, 8, 'spy'],
      [5, 8, 'lancer'],
      [2, 8, 'spy'],
      ...BACK_ROW,
    ],
    hand: { major: 2, lancer: 2, rider: 2, soldier: 1 },
  },
  beginner: {
    layout: [
      ...FRONT_ROW,
      [8, 8, 'spy'],
      [7, 8, 'archer'],
      [5, 8, 'lancer'],
      [3, 8, 'archer'],
      [2, 8, 'rider'],
      ...BACK_ROW,
    ],
    hand: { major: 2, lancer: 2, spy: 1, rider: 1, soldier: 1 },
  },
};

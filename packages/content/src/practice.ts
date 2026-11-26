import { fenFromTowers, type Color, type Outcome } from '@ligungi/engine';

/**
 * What a practice position asks, against the computer at its strongest. `mate`: win by mate within that many of your
 * moves. `win`: win in any way within them. `survive`: still be in the game after them (a draw or a win also counts).
 */
export type PracticeGoal =
  | { readonly kind: 'mate'; readonly moves: number }
  | { readonly kind: 'win'; readonly moves: number }
  | { readonly kind: 'survive'; readonly moves: number };

export interface PracticePosition {
  readonly id: string;
  readonly fen: string;
  readonly goal: PracticeGoal;
}

export const PRACTICE_SECTION_IDS = ['endgames', 'advantage', 'defense'] as const;
export type PracticeSectionId = (typeof PRACTICE_SECTION_IDS)[number];

export interface PracticeSection {
  readonly id: PracticeSectionId;
  readonly positions: readonly PracticePosition[];
}

/** The computer's level in practice: always the strongest. */
export const PRACTICE_LEVEL = 5;

const INTRO = '3lmg3/1y2n2y1/p1fspsf1p/9/9/9/P1FSPSF1P/1Y2N2Y1/3GML3 w 2J2N2RP2j2n2rp intro p w';

export const PRACTICE_SECTIONS: readonly PracticeSection[] = [
  {
    id: 'endgames',
    positions: [
      { id: 'endgame-lancers', fen: fenFromTowers({ e3: 'M', e8: 'm', a6: 'G', d4: 'N', f4: 'N' }), goal: { kind: 'mate', moves: 12 } },
      { id: 'endgame-general-samurais', fen: fenFromTowers({ e4: 'M', e9: 'm', a7: 'G', d6: 'S', f6: 'S', e5: 'N' }), goal: { kind: 'mate', moves: 8 } },
      { id: 'endgame-general-majors', fen: fenFromTowers({ e3: 'M', e8: 'm', a6: 'G', d5: 'J', f5: 'J' }), goal: { kind: 'mate', moves: 12 } },
      { id: 'endgame-hand', fen: fenFromTowers({ e5: 'M', e9: 'm', e7: 'P' }, { hands: 'G2S' }), goal: { kind: 'mate', moves: 8 } },
    ],
  },
  {
    id: 'advantage',
    positions: [
      { id: 'advantage-two', fen: fenFromTowers({ e2: 'M', c5: 'G', d5: 'J', f5: 'J', e8: 'm', f7: 'p' }), goal: { kind: 'win', moves: 12 } },
      { id: 'advantage-endgame', fen: fenFromTowers({ e2: 'M', e8: 'm', c4: 'G', g4: 'L', d5: 'S', f5: 'S', d8: 's', f7: 'p' }), goal: { kind: 'win', moves: 15 } },
    ],
  },
  {
    id: 'defense',
    positions: [
      { id: 'defense-down-general', fen: INTRO.replace('/3GML3 ', '/4ML3 '), goal: { kind: 'survive', moves: 20 } },
      { id: 'defense-attack', fen: fenFromTowers({ e1: 'M', d2: 'S', f2: 'S', e2: 'F', c6: 'g', g6: 'l', e9: 'm', e7: 'n' }), goal: { kind: 'survive', moves: 12 } },
      { id: 'defense-hand', fen: fenFromTowers({ e1: 'M', d1: 'F', f1: 'F', e8: 'm', d5: 'g', f5: 's' }, { hands: '2PS' }), goal: { kind: 'survive', moves: 12 } },
    ],
  },
];

export const PRACTICE_POSITIONS: readonly PracticePosition[] = PRACTICE_SECTIONS.flatMap((section) => section.positions);

/**
 * How a practice game stands after the player's latest move or the computer's reply. `playerMoves` counts the player's
 * moves so far.
 */
export const practiceResult = (goal: PracticeGoal, outcome: Outcome | null, playerMoves: number, player: Color): 'playing' | 'won' | 'failed' => {
  if (outcome) {
    if (outcome.winner === player) return goal.kind !== 'mate' || outcome.reason === 'mate' || outcome.reason === 'capture' ? 'won' : 'failed';
    return goal.kind === 'survive' && outcome.winner === null ? 'won' : 'failed';
  }
  if (playerMoves >= goal.moves) return goal.kind === 'survive' ? 'won' : 'failed';
  return 'playing';
};

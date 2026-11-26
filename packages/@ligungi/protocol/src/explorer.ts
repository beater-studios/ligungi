import type { Mode } from '@ligungi/engine';

/** Modes with a draft, the only ones the explorer covers. */
export const EXPLORER_MODES = ['intermediate', 'advanced'] as const satisfies readonly Mode[];
export type ExplorerMode = (typeof EXPLORER_MODES)[number];

/** Rating ranges, by the average of both players' ratings when the game was played. */
export const EXPLORER_BANDS = ['all', 'below1400', '1400to1700', 'from1700'] as const;
export type ExplorerBand = (typeof EXPLORER_BANDS)[number];

/** How the games that went through a position (or played a move) ended. */
export interface ExplorerStats {
  readonly games: number;
  readonly white: number;
  readonly draws: number;
  readonly black: number;
  /** Average rating of the rated players in those games; `null` when none had one. */
  readonly rating: number | null;
}

export interface ExplorerMove extends ExplorerStats {
  /** Machine notation. */
  readonly move: string;
}

/** A draft position in the explorer: the games that reached it, and what was played next, most played first. */
export interface ExplorerView {
  readonly fen: string;
  readonly total: ExplorerStats;
  readonly moves: readonly ExplorerMove[];
  /** When the statistics were last computed. */
  readonly updatedAt: number;
}

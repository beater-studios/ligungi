import {
  COLORS,
  SQUARE_COUNT,
  applyMove,
  legalMoves,
  moveToString,
  parseFen,
  positionProblems,
  type Color,
  type Position,
  type PositionProblem,
} from '@ligungi/engine';
import type { UserRef } from './index.ts';

/** `public` studies are listed and searchable, `unlisted` ones open only through their link, `private` ones only for their author. */
export const STUDY_VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type StudyVisibility = (typeof STUDY_VISIBILITIES)[number];

export const STUDY_TITLE_MAX = 80;
export const STUDY_DESCRIPTION_MAX = 300;
export const STUDY_CHAPTER_NAME_MAX = 80;
export const STUDY_CHAPTERS_MAX = 32;
/** Studies one account may keep. */
export const STUDIES_MAX = 100;
/** Moves in one chapter, counting every variation. */
export const STUDY_NODES_MAX = 500;
export const STUDY_COMMENT_MAX = 1000;
/** A chapter is saved whole, so its JSON has to fit well inside the server's request limit. */
export const STUDY_CHAPTER_BYTES_MAX = 48_000;
/** Days an account must exist before it can publish a public study. */
export const STUDY_PUBLIC_MIN_DAYS = 7;
export const STUDY_LIST_PAGE = 30;
export const STUDY_QUERY_MAX = 50;

/**
 * Drawings per move. Arrows join square centers and squares are painted whole, so nothing is drawn freehand; with
 * this few marks a picture other than an annotation is very hard to make.
 */
export const STUDY_ARROWS_MAX = 2;
export const STUDY_SQUARES_MAX = 4;
export const SHAPE_COLORS = ['green', 'red', 'blue', 'orange'] as const;
export type ShapeColor = (typeof SHAPE_COLORS)[number];

export type StudyShape =
  | { readonly kind: 'arrow'; readonly from: number; readonly to: number; readonly color: ShapeColor }
  | { readonly kind: 'square'; readonly square: number; readonly color: ShapeColor };

/** The start of a chapter, before any move: its own comment and drawings, and the moves that may follow. */
export interface StudyRoot {
  readonly comment: string;
  readonly shapes: readonly StudyShape[];
  /** The first child continues the main line; the others are variations. */
  readonly children: readonly StudyNode[];
}

/** One move of a chapter, in the machine notation, with what the author wrote and drew after it. */
export interface StudyNode extends StudyRoot {
  readonly move: string;
}

export interface StudyChapter {
  readonly id: string;
  readonly name: string;
  /** The position the chapter starts from. */
  readonly fen: string;
  readonly orientation: Color;
  readonly root: StudyRoot;
}

export interface StudyChapterRef {
  readonly id: string;
  readonly name: string;
}

export interface StudyView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly visibility: StudyVisibility;
  readonly owner: UserRef;
  /** Hidden by a moderator: only the author and the moderators can still open it. */
  readonly hidden: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly chapters: readonly StudyChapterRef[];
  /** The viewer is the author and may edit it. */
  readonly mine: boolean;
}

export interface StudyListItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly owner: UserRef;
  readonly visibility: StudyVisibility;
  readonly hidden: boolean;
  readonly chapters: number;
  readonly updatedAt: number;
}

export interface StudyList {
  readonly studies: readonly StudyListItem[];
  readonly more: boolean;
}

export const emptyRoot = (): StudyRoot => ({ comment: '', shapes: [], children: [] });

export const shapeCounts = (shapes: readonly StudyShape[]): { arrows: number; squares: number } => ({
  arrows: shapes.filter((shape) => shape.kind === 'arrow').length,
  squares: shapes.filter((shape) => shape.kind === 'square').length,
});

const sameSpot = (a: StudyShape, b: StudyShape): boolean =>
  a.kind === 'arrow' ? b.kind === 'arrow' && a.from === b.from && a.to === b.to : b.kind === 'square' && a.square === b.square;

/**
 * Draws a shape the way the board's gestures work: the same gesture with the same color erases it, with another
 * color repaints it, and a new one is added only while the move is under its limit.
 */
export const toggleShape = (shapes: readonly StudyShape[], shape: StudyShape): readonly StudyShape[] | 'limit' => {
  const existing = shapes.find((other) => sameSpot(other, shape));
  if (existing) return existing.color === shape.color ? shapes.filter((other) => other !== existing) : shapes.map((other) => (other === existing ? shape : other));
  const counts = shapeCounts(shapes);
  if (shape.kind === 'arrow' ? counts.arrows >= STUDY_ARROWS_MAX : counts.squares >= STUDY_SQUARES_MAX) return 'limit';
  return [...shapes, shape];
};

export const isStudyVisibility = (value: unknown): value is StudyVisibility => STUDY_VISIBILITIES.includes(value as StudyVisibility);

/** Trimmed text within `max` characters, or `null`. */
export const studyText = (value: unknown, max: number, required: boolean): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length > max || (required && !text)) return null;
  return text;
};

/**
 * Whether a problem of the board editor's check still applies. During the draft the Marshals may still be in hand or
 * missing from the board, and nothing can be captured, so a Marshal under attack means nothing yet.
 */
const matters = (position: Position, problem: PositionProblem): boolean =>
  position.phase === 'play' ||
  !(problem.kind === 'marshalInHand' || problem.kind === 'waitingInCheck' || (problem.kind === 'marshalCount' && problem.count === 0));

/** A start position a chapter may use: a valid FEN of a position the rules can reach, in the draft or in play. */
export const studyStart = (fen: unknown): Position | null => {
  if (typeof fen !== 'string' || fen.length > 300) return null;
  try {
    const position = parseFen(fen);
    return positionProblems(position).some((problem) => matters(position, problem)) ? null : position;
  } catch {
    return null;
  }
};

const isSquare = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < SQUARE_COUNT;

const parseShapes = (value: unknown): StudyShape[] | null => {
  if (!Array.isArray(value)) return null;
  const shapes: StudyShape[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { kind, color, from, to, square } = item as Record<string, unknown>;
    if (!SHAPE_COLORS.includes(color as ShapeColor)) return null;
    const shape: StudyShape | null =
      kind === 'arrow' && isSquare(from) && isSquare(to) && from !== to
        ? { kind, from, to, color: color as ShapeColor }
        : kind === 'square' && isSquare(square)
          ? { kind, square, color: color as ShapeColor }
          : null;
    if (!shape || shapes.some((other) => sameSpot(other, shape))) return null;
    shapes.push(shape);
  }
  const counts = shapeCounts(shapes);
  return counts.arrows <= STUDY_ARROWS_MAX && counts.squares <= STUDY_SQUARES_MAX ? shapes : null;
};

/** Moves in a chapter, counting every variation. */
export const countNodes = (root: StudyRoot): number => root.children.reduce((sum, child) => sum + 1 + countNodes(child), 0);

/** Whether a chapter still fits its limits once saved: moves, and the size of the whole tree. */
export const chapterFits = (root: StudyRoot): boolean =>
  countNodes(root) <= STUDY_NODES_MAX && new TextEncoder().encode(JSON.stringify(root)).length <= STUDY_CHAPTER_BYTES_MAX;

/**
 * Checks a chapter's tree from untrusted input and returns it clean: every move legal where it is played, no move
 * twice under the same parent, and comments and drawings within their limits. `tooLarge` when it has too many moves
 * or is too big, `null` when anything else is off.
 */
export const parseStudyRoot = (start: Position, value: unknown): StudyRoot | 'tooLarge' | null => {
  let nodes = 0;
  let tooLarge = false;
  const visit = (raw: unknown, position: Position): StudyRoot | null => {
    if (typeof raw !== 'object' || raw === null) return null;
    const { comment, shapes, children } = raw as Record<string, unknown>;
    const text = comment === undefined ? '' : studyText(comment, STUDY_COMMENT_MAX, false);
    const drawn = shapes === undefined ? [] : parseShapes(shapes);
    if (text === null || drawn === null || !Array.isArray(children)) return null;
    const legal = children.length ? new Map(legalMoves(position).map((move) => [moveToString(move), move])) : new Map();
    const parsed: StudyNode[] = [];
    for (const child of children as unknown[]) {
      if (++nodes > STUDY_NODES_MAX) {
        tooLarge = true;
        return null;
      }
      if (typeof child !== 'object' || child === null) return null;
      const key = (child as Record<string, unknown>).move;
      const move = typeof key === 'string' ? legal.get(key) : undefined;
      if (!move || parsed.some((other) => other.move === key)) return null;
      const node = visit(child, applyMove(position, move));
      if (!node) return null;
      parsed.push({ move: key as string, ...node });
    }
    return { comment: text, shapes: drawn, children: parsed };
  };
  const root = visit(value, start);
  if (tooLarge) return 'tooLarge';
  if (!root) return null;
  return chapterFits(root) ? root : 'tooLarge';
};

export const isOrientation = (value: unknown): value is Color => COLORS.includes(value as Color);

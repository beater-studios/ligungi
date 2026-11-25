import { applyMove, parseMove, type Move, type Position } from '@ligungi/engine';
import type { StudyNode, StudyRoot } from '@ligungi/protocol';

/** Where a node sits in a chapter: the index of the child taken at each level. `[]` is the start of the chapter. */
export type Path = readonly number[];

export const samePath = (a: Path, b: Path): boolean => a.length === b.length && a.every((step, i) => step === b[i]);

export const nodeAt = (root: StudyRoot, path: Path): StudyRoot | undefined => {
  let node: StudyRoot | undefined = root;
  for (const step of path) node = node?.children[step];
  return node;
};

/** The moves from the start of the chapter to `path`, in order. */
export const movesAlong = (root: StudyRoot, path: Path): Move[] => {
  const moves: Move[] = [];
  let node: StudyRoot = root;
  for (const step of path) {
    const child: StudyNode | undefined = node.children[step];
    const move = child && parseMove(child.move);
    if (!child || !move) break;
    moves.push(move);
    node = child;
  }
  return moves;
};

export const positionAt = (start: Position, root: StudyRoot, path: Path): Position =>
  movesAlong(root, path).reduce((position, move) => applyMove(position, move), start);

/** Follows the main line (first children) from `path` to its end. */
export const lineEnd = (root: StudyRoot, path: Path): Path => {
  const end = [...path];
  let node = nodeAt(root, path);
  while (node?.children.length) {
    end.push(0);
    node = node.children[0];
  }
  return end;
};

/** A copy of the tree with the node at `path` replaced by `update(node)`. */
export const updateAt = <T extends StudyRoot>(root: T, path: Path, update: (node: StudyRoot) => StudyRoot): T => {
  if (path.length === 0) return { ...root, ...update(root) };
  const [step, ...rest] = path;
  return { ...root, children: root.children.map((child, i) => (i === step ? updateAt(child, rest, update) : child)) };
};

/**
 * Plays `move` after the node at `path`: goes to the child that already has it, or adds it as the main line when the
 * node had no continuation and as a new variation otherwise.
 */
export const addMove = (root: StudyRoot, path: Path, move: string): { root: StudyRoot; path: Path } => {
  const node = nodeAt(root, path);
  if (!node) return { root, path };
  const existing = node.children.findIndex((child) => child.move === move);
  if (existing >= 0) return { root, path: [...path, existing] };
  const child: StudyNode = { move, comment: '', shapes: [], children: [] };
  return { root: updateAt(root, path, (n) => ({ ...n, children: [...n.children, child] })), path: [...path, node.children.length] };
};

/** Removes the node at `path` with everything after it; the parent becomes the current node. */
export const deleteAt = (root: StudyRoot, path: Path): { root: StudyRoot; path: Path } => {
  if (path.length === 0) return { root, path };
  const parent = path.slice(0, -1);
  const index = path[path.length - 1]!;
  return { root: updateAt(root, parent, (n) => ({ ...n, children: n.children.filter((_, i) => i !== index) })), path: parent };
};

/** Makes the line through `path` the main line at every level; returns the tree and where the node now is. */
export const promote = (root: StudyRoot, path: Path): { root: StudyRoot; path: Path } => {
  let next = root;
  for (let depth = 0; depth < path.length; depth++) {
    const index = path[depth]!;
    if (index === 0) continue;
    // Earlier levels were already moved to the front, so the parent is reached through first children.
    next = updateAt(next, path.slice(0, depth).map(() => 0), (n) => ({
      ...n,
      children: [n.children[index]!, ...n.children.filter((_, i) => i !== index)],
    }));
  }
  return { root: next, path: path.map(() => 0) };
};

/** A tree holding one line of moves, such as a game's. */
export const lineRoot = (moves: readonly string[]): StudyRoot => {
  let children: StudyNode[] = [];
  for (let i = moves.length - 1; i >= 0; i--) children = [{ move: moves[i]!, comment: '', shapes: [], children }];
  return { comment: '', shapes: [], children };
};

/** The tree with every drawing removed, as the moderators' clear-drawings leaves a chapter. */
export const withoutShapes = <T extends StudyRoot>(node: T): T => ({ ...node, shapes: [], children: node.children.map(withoutShapes) });

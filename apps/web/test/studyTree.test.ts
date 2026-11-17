import { initialPosition, toFen } from '@ligungi/engine';
import { emptyRoot, type StudyRoot } from '@ligungi/protocol';
import { describe, expect, it } from 'vitest';
import { addMove, deleteAt, lineEnd, lineRoot, nodeAt, positionAt, promote, updateAt } from '../src/studyTree.ts';

const moves = (root: StudyRoot): string[] => root.children.map((child) => child.move);

describe('study tree', () => {
  it('adds a main line, then variations, and reuses a move already there', () => {
    let tree = emptyRoot();
    let path: readonly number[] = [];
    ({ root: tree, path } = addMove(tree, path, 'e3e4'));
    ({ root: tree, path } = addMove(tree, path, 'e7e6'));
    expect(path).toEqual([0, 0]);
    ({ root: tree, path } = addMove(tree, [], 'c3c4'));
    expect(path).toEqual([1]);
    expect(moves(tree)).toEqual(['e3e4', 'c3c4']);
    const again = addMove(tree, [], 'c3c4');
    expect(again.path).toEqual([1]);
    expect(again.root).toBe(tree);
    expect(lineEnd(tree, [])).toEqual([0, 0]);
  });

  it('computes the position at a node', () => {
    const tree = lineRoot(['e3e4', 'e7e6']);
    const start = initialPosition('intro');
    expect(toFen(positionAt(start, tree, [0, 0]))).not.toBe(toFen(start));
    expect(positionAt(start, tree, [0, 0]).turn).toBe(start.turn);
  });

  it('deletes a node with what follows it and promotes a variation to the main line', () => {
    let tree = lineRoot(['e3e4', 'e7e6', 'd3d4']);
    tree = addMove(tree, [], 'c3c4').root;
    tree = addMove(tree, [1], 'e7e6').root;
    tree = addMove(tree, [1, 0], 'd3d4').root;
    tree = addMove(tree, [1, 0], 'g3g4').root;
    const promoted = promote(tree, [1, 0, 1]);
    expect(promoted.path).toEqual([0, 0, 0]);
    expect(moves(promoted.root)).toEqual(['c3c4', 'e3e4']);
    expect(moves(nodeAt(promoted.root, [0, 0])!)).toEqual(['g3g4', 'd3d4']);

    const deleted = deleteAt(promoted.root, [0, 0]);
    expect(deleted.path).toEqual([0]);
    expect(nodeAt(deleted.root, [0])!.children).toEqual([]);
    expect(deleteAt(tree, []).root).toBe(tree);
  });

  it('updates one node without touching the others', () => {
    const tree = lineRoot(['e3e4', 'e7e6']);
    const commented = updateAt(tree, [0, 0], (node) => ({ ...node, comment: 'Bom lance' }));
    expect(nodeAt(commented, [0, 0])!.comment).toBe('Bom lance');
    expect(nodeAt(tree, [0, 0])!.comment).toBe('');
    expect(updateAt(tree, [], (node) => ({ ...node, comment: 'Início' })).comment).toBe('Início');
  });
});

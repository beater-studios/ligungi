import { applyMove, parseMove, type Position } from '@ligungi/engine';
import type { StudyNode, StudyRoot } from '@ligungi/protocol';
import type { VNode } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useMoveText } from '../game/notation.ts';
import { samePath, type Path } from './studyTree.ts';

interface Props {
  readonly start: Position;
  readonly root: StudyRoot;
  readonly current: Path;
  readonly onSelect: (path: Path) => void;
  readonly empty: string;
}

/** Move number of the move at `ply` (1 for the first move), as in a column of pairs. */
const indexText = (ply: number): string => (ply % 2 === 1 ? `${(ply + 1) / 2}.` : `${ply / 2}...`);

/**
 * The moves of a study chapter in lila's tree view: the main line in two columns, and after a move its comment and
 * the variations that branch there, each variation on its own line with deeper ones in parentheses.
 */
export const StudyMoves = ({ start, root, current, onSelect, empty }: Props) => {
  const moveText = useMoveText();
  const tree = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = tree.current?.querySelector('move.active') as HTMLElement | null;
    if (active && tree.current) tree.current.scrollTop = active.offsetTop - tree.current.clientHeight / 2;
  }, [current]);

  const after = (position: Position, node: StudyNode): Position => {
    const move = parseMove(node.move);
    return move ? applyMove(position, move) : position;
  };

  const moveEl = (node: StudyNode, path: Path, position: Position, ply: number, withIndex: boolean): VNode => {
    const move = parseMove(node.move);
    const { text, full } = move ? moveText(position, move) : { text: node.move, full: undefined };
    return (
      <move key={`m${path.join('.')}`} class={samePath(path, current) ? 'active' : ''} title={full} aria-label={full} onClick={() => onSelect(path)}>
        {withIndex && <index>{indexText(ply)}</index>}
        {text}
        {node.shapes.length > 0 && <shapes />}
      </move>
    );
  };

  const commentEl = (node: StudyRoot, path: Path): VNode | null => (node.comment ? <comment key={`c${path.join('.')}`}>{node.comment}</comment> : null);

  /** The moves after `parent` inside a variation: its main child, the other children in parentheses, then onwards. */
  const lineAfter = (parent: StudyRoot, path: Path, position: Position, ply: number, forceIndex: boolean): VNode[] => {
    const [main, ...others] = parent.children;
    if (!main) return [];
    const mainPath = [...path, 0];
    const out: VNode[] = [moveEl(main, mainPath, position, ply, forceIndex || ply % 2 === 1)];
    const note = commentEl(main, mainPath);
    if (note) out.push(note);
    others.forEach((other, i) => {
      const otherPath = [...path, i + 1];
      out.push(
        <inline key={`i${otherPath.join('.')}`}>
          {variation(other, otherPath, position, ply)}
        </inline>,
      );
    });
    return [...out, ...lineAfter(main, mainPath, after(position, main), ply + 1, others.length > 0 || note !== null)];
  };

  const variation = (node: StudyNode, path: Path, position: Position, ply: number): VNode[] => {
    const note = commentEl(node, path);
    return [moveEl(node, path, position, ply, true), ...(note ? [note] : []), ...lineAfter(node, path, after(position, node), ply + 1, note !== null)];
  };

  /** The main line from `parent` on, breaking the columns where a move has a comment or variations. */
  const mainline = (parent: StudyRoot, path: Path, position: Position, ply: number, resumed: boolean): VNode[] => {
    const [main, ...others] = parent.children;
    if (!main) return [];
    const mainPath = [...path, 0];
    const first = ply % 2 === 1;
    const out: VNode[] = [];
    if (first) out.push(<index key={`n${mainPath.join('.')}`}>{(ply + 1) / 2}</index>);
    else if (resumed) {
      out.push(<index key={`n${mainPath.join('.')}`}>{ply / 2}</index>, <move key={`e${mainPath.join('.')}`} class="empty">...</move>);
    }
    out.push(moveEl(main, mainPath, position, ply, false));
    const breaks = main.comment !== '' || others.length > 0;
    if (breaks) {
      if (first) out.push(<move key={`f${mainPath.join('.')}`} class="empty">...</move>);
      out.push(
        <interrupt key={`x${mainPath.join('.')}`}>
          {commentEl(main, mainPath)}
          {others.length > 0 && (
            <lines>
              {others.map((other, i) => {
                const otherPath = [...path, i + 1];
                return (
                  <line key={`l${otherPath.join('.')}`}>
                    <branch />
                    {variation(other, otherPath, position, ply)}
                  </line>
                );
              })}
            </lines>
          )}
        </interrupt>,
      );
    }
    return [...out, ...mainline(main, mainPath, after(position, main), ply + 1, breaks && first)];
  };

  const moves = mainline(root, [], start, 1, false);
  return (
    <div class="tview2 tview2-column" ref={tree}>
      {root.comment && (
        <interrupt>
          <comment>{root.comment}</comment>
        </interrupt>
      )}
      {moves.length ? moves : <p class="ligungi-empty">{empty}</p>}
    </div>
  );
};

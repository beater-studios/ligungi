import { parseFen, topOf, type Color, type Position, type Square } from '@ligungi/engine';
import { PieceGlyph } from './PieceGlyph.tsx';
import { visualSquares as visualOrder } from '@ligungi/board';

interface MiniBoardProps {
  readonly position?: Position;
  readonly fen?: string;
  readonly orientation?: Color;
  /** Extra class per square, e.g. movement diagrams. */
  readonly marks?: ReadonlyMap<Square, string>;
}

/** Static, non-interactive board for lists, TV and diagrams. */
export const MiniBoard = ({ position, fen, orientation = 'white', marks }: MiniBoardProps) => {
  const pos = position ?? (fen ? parseFen(fen) : undefined);
  if (!pos) return null;
  return (
    <div class="gg-mini gg-palette">
      {visualOrder(orientation).map((square) => {
        const tower = pos.board[square]!;
        const top = topOf(tower);
        return (
          <div key={square} class={`gg-mini-sq ${marks?.get(square) ?? ''}`}>
            {top && (
              <span class={`gg-mini-piece ${top.color}${top.color !== orientation ? ' flipped' : ''}`}>
                <PieceGlyph role={top.role} />
                {tower.length > 1 && <i>{tower.length}</i>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

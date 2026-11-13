import { pieceName } from '@ligungi/board';
import { ROLE_INFO, handSize, type Color, type Position, type Square } from '@ligungi/engine';
import { usePieceNames, useT } from '../i18n/index.ts';
import { prefs } from '../prefs.ts';
import { useStore } from '../store.ts';
import { PieceGlyph } from './PieceGlyph.tsx';

/** Fixed panel with the composition of the tower the user is looking at, top first. */
export const TowerPanel = ({ position, square }: { position: Position; square: Square | null }) => {
  const t = useT();
  const pieceNames = usePieceNames();
  const { pieceStyle } = useStore(prefs);
  const tower = square === null ? [] : position.board[square]!;
  return (
    <section class="ligungi-tower gg-palette">
      <h3>{tower.length > 1 ? t.panels.tower(tower.length) : t.panels.piece}</h3>
      {tower.length === 0 ? (
        <p class="ligungi-notice">{t.panels.towerHint}</p>
      ) : (
        <ol>
          {[...tower]
            .map((piece, level) => ({ piece, level }))
            .reverse()
            .map(({ piece, level }) => (
              <li key={level}>
                <span class={`gg-mini-piece ${piece.color}`}>
                  <PieceGlyph role={piece.role} />
                </span>
                <span class="ligungi-tower__name">
                  {pieceName(piece.role, pieceNames)}
                  {pieceStyle === 'illustrated' && <span class="ligungi-tower__kanji">{ROLE_INFO[piece.role].kanji}</span>}
                </span>
                <span class="ligungi-tower__meta">
                  {t.colors[piece.color]} · {t.panels.level(level + 1)}
                </span>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
};

/** Draft progress: pieces placed, pieces left in hand and who declared done. */
export const DraftPanel = ({ position, names }: { position: Position; names: Readonly<Record<Color, string>> }) => {
  const t = useT();
  if (position.phase !== 'draft') return null;
  const placed = (color: Color) =>
    position.board.reduce((sum, tower) => sum + tower.filter((piece) => piece.color === color).length, 0);
  return (
    <section class="ligungi-draft">
      <h3>{t.panels.draft}</h3>
      <ul>
        {(['white', 'black'] as const).map((color) => (
          <li key={color} class={position.turn === color ? 'active' : ''}>
            <span class={`color-icon is ${color}`} />
            <span class="ligungi-draft__name">{names[color]}</span>
            <span class="ligungi-draft__count">
              {t.panels.draftCount(placed(color), handSize(position.hands[color]))}
            </span>
            {position.draftDone[color] && <span class="ligungi-draft__done">{t.panels.draftDone}</span>}
          </li>
        ))}
      </ul>
      <p class="ligungi-notice">
        {position.freeDraft ? t.panels.draftFreeNotice : t.panels.draftBookNotice}
      </p>
    </section>
  );
};

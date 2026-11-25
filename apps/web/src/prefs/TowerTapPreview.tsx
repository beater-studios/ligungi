import { glyphClass, pieceGlyph, pieceName, visualSquares } from '@ligungi/board';
import { parseFen, type Square } from '@ligungi/engine';
import { usePieceNames, useT } from '../i18n/index.ts';
import { guidesShown, prefs, type TowerTap } from './prefs.ts';
import { useStore } from '../core/store.ts';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { TowerStrip } from '../components/Panels.tsx';

/** A beginner game with a tower of three on the left, the one shown tapped, so the balloon fits on its right. */
const POSITION = parseFen('3lmg3/1ra1n1ay1/p1fspsf1p/9/1(PpS)1(Pp)5/9/P1FSPSF1P/1YA1N1AR1/3GML3 w 2J2NRYP2j2nryp beginner p w');
const ORDER = visualSquares('white');
const TAPPED: Square = ORDER.find((square) => POSITION.board[square]!.length === 3)!;
const MARKS = new Map([[TAPPED, 'ligungi-tap-preview__tapped']]);

/**
 * What tapping a tower shows on a phone, for the choice in Settings: the board's balloon beside the square, the strip
 * under the board, or nothing on the board (the side panel, below the game on a phone).
 */
export const TowerTapPreview = ({ mode }: { mode: TowerTap }) => {
  const t = useT();
  const names = usePieceNames();
  const current = useStore(prefs);
  const layout = glyphClass(current.pieceStyle, guidesShown(current));
  const index = ORDER.indexOf(TAPPED);
  const row = Math.floor(index / 9);
  const column = index % 9;
  const tower = POSITION.board[TAPPED]!;
  return (
    <figure class="ligungi-tap-preview" aria-hidden="true">
      <div class="ligungi-tap-preview__phone">
        <div class="ligungi-tap-preview__board gg-palette">
          <MiniBoard position={POSITION} marks={MARKS} />
          {mode === 'balloon' && (
            <div class="gg-inspector" style={{ left: `${((column + 1) * 100) / 9}%`, top: `${(row * 100) / 9}%` }}>
              <div class="gg-inspector-title">
                {t.board.tower} ({tower.length})
              </div>
              <ol>
                {[...tower]
                  .map((piece, level) => ({ piece, level }))
                  .reverse()
                  .map(({ piece, level }) => (
                    <li key={level}>
                      <div
                        class={`gg-piece gg-${piece.color} gg-top${layout ? ` ${layout}` : ''}`}
                        dangerouslySetInnerHTML={{ __html: `<span>${pieceGlyph(piece.role, current.pieceStyle, guidesShown(current), names)}</span>` }}
                      />
                      <span class="gg-name">{pieceName(piece.role, names)}</span>
                      <span class="gg-level">
                        {t.board.level} {level + 1}
                      </span>
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </div>
        {mode === 'strip' && <TowerStrip position={POSITION} square={TAPPED} />}
        {mode === 'panel' && <p class="ligungi-tap-preview__note">{t.settings.towerTapPanelPreview}</p>}
      </div>
      <figcaption>{t.settings.piecePreview}</figcaption>
    </figure>
  );
};

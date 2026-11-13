import { coordinateLabels, glyphClass, pieceGlyph } from '@ligungi/board';
import type { Color, Role } from '@ligungi/engine';
import { useT } from '../i18n/index.ts';
import { prefs } from '../prefs.ts';
import { useStore } from '../store.ts';

/** The top right 3x3 corner of a board as White sees it, row by row: the opponent above, the player below. */
const SQUARES: ReadonlyArray<readonly [Role, Color] | null> = [
  ['spy', 'black'], null, ['fortress', 'black'],
  null, ['general', 'white'], null,
  ['archer', 'white'], null, ['rider', 'white'],
];

/** The board drawn as in a game, with the current theme, piece style, movement indicators and coordinates. */
export const PiecePreview = () => {
  const t = useT();
  const { pieceStyle, moveGuides, coordinates, notation } = useStore(prefs);
  const labels = coordinateLabels('white', notation === 'machine' ? 'algebraic' : 'rulebook');
  const columns = labels.columns.slice(-3);
  const layout = glyphClass(pieceStyle, moveGuides);
  return (
    <figure class="ligungi-preview">
      <div class="ligungi-board-preview gg-palette" aria-hidden="true">
        {SQUARES.map((piece, index) => (
          <div key={index} class="ligungi-board-preview__sq">
            {coordinates && index < 3 && <span class="ligungi-board-preview__col">{columns[index]}</span>}
            {coordinates && index % 3 === 2 && <span class="ligungi-board-preview__row">{labels.rows[Math.floor(index / 3)]}</span>}
            {piece && (
              <div
                class={`gg-piece gg-${piece[1]} gg-top${piece[1] === 'black' ? ' gg-flipped' : ''}${layout ? ` ${layout}` : ''}`}
                dangerouslySetInnerHTML={{ __html: `<span>${pieceGlyph(piece[0], pieceStyle, moveGuides)}</span>` }}
              />
            )}
          </div>
        ))}
      </div>
      <figcaption>{t.settings.piecePreview}</figcaption>
    </figure>
  );
};

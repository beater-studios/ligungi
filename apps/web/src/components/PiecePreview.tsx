import { glyphClass, pieceGlyph } from '@ligungi/board';
import type { Color, Role } from '@ligungi/engine';
import { useT } from '../i18n/index.ts';
import { prefs } from '../prefs.ts';
import { useStore } from '../store.ts';

/** A 3x3 corner of a board, row by row: the opponent above, the player below. */
const SQUARES: ReadonlyArray<readonly [Role, Color] | null> = [
  ['spy', 'black'], null, ['fortress', 'black'],
  null, ['general', 'white'], null,
  ['archer', 'white'], null, ['rider', 'white'],
];

/** Pieces drawn exactly as on the board, with the current piece style and movement indicators. */
export const PiecePreview = () => {
  const t = useT();
  const { pieceStyle, moveGuides } = useStore(prefs);
  const layout = glyphClass(pieceStyle, moveGuides);
  return (
    <figure class="ligungi-preview">
      <div class="ligungi-board-preview gg-palette" aria-hidden="true">
        {SQUARES.map((piece, index) => (
          <div key={index} class="ligungi-board-preview__sq">
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

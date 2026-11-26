import { coordinateLabels, glyphClass, pieceGlyph } from '@ligungi/board';
import type { Color, Role } from '@ligungi/engine';
import { usePieceNames, useT } from '../i18n/index.ts';
import { guidesShown, prefs } from './prefs.ts';
import { useStore } from '../core/store.ts';

/**
 * The top right 3x3 corner of a board as White sees it, row by row: the opponent above, the player below, and a tower
 * of three in the middle (its pieces from the bottom up, one of them Black), so the 3D view shows its height and the
 * pieces under each tower show their order and colors.
 */
const SQUARES: ReadonlyArray<ReadonlyArray<readonly [Role, Color]> | null> = [
  [['spy', 'black']], null, [['fortress', 'black']],
  null, [['soldier', 'black'], ['samurai', 'white'], ['general', 'white']], null,
  [['archer', 'white']], null, [['rider', 'white']],
];

/** The board drawn as in a game, with the current theme, piece style, movement indicators, tower contents and coordinates. */
export const PiecePreview = () => {
  const t = useT();
  const current = useStore(prefs);
  const { pieceStyle, coordinates, notation, towerContents } = current;
  const moveGuides = guidesShown(current);
  const names = usePieceNames();
  const labels = coordinateLabels('white', notation === 'machine' ? 'algebraic' : 'rulebook');
  const columns = labels.columns.slice(-3);
  const layout = glyphClass(pieceStyle, moveGuides);
  const chipLayout = glyphClass(pieceStyle, false);
  return (
    <figure class="ligungi-preview">
      <div class="ligungi-board-preview gg-stage gg-palette" aria-hidden="true">
        {SQUARES.map((stack, index) => (
          <div key={index} class="ligungi-board-preview__sq">
            {coordinates && index < 3 && <span class="ligungi-board-preview__col">{columns[index]}</span>}
            {coordinates && index % 3 === 2 && <span class="ligungi-board-preview__row">{labels.rows[Math.floor(index / 3)]}</span>}
            {stack && (
              <div class="gg-tower" style={`--height:${stack.length}`}>
                {stack.map(([role, color], level) => (
                  <div
                    key={level}
                    class={`gg-piece gg-${color} ${level === stack.length - 1 ? 'gg-top' : 'gg-under'}${color === 'black' ? ' gg-flipped' : ''}${layout ? ` ${layout}` : ''}`}
                    style={`--level:${level}`}
                    dangerouslySetInnerHTML={{ __html: `<span>${pieceGlyph(role, pieceStyle, moveGuides, names)}</span>` }}
                  />
                ))}
                {towerContents && stack.length > 1 && (
                  <span class="gg-contents">
                    {stack.slice(0, -1).map(([role, color], level) => (
                      <span
                        key={level}
                        class={`gg-chip gg-${color}${chipLayout ? ` ${chipLayout}` : ''}`}
                        style={`--chip:${level}`}
                        dangerouslySetInnerHTML={{ __html: pieceGlyph(role, pieceStyle, false, names) }}
                      />
                    ))}
                  </span>
                )}
                {stack.length > 1 && <span class="gg-height">{stack.length}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      <figcaption>{t.settings.piecePreview}</figcaption>
    </figure>
  );
};

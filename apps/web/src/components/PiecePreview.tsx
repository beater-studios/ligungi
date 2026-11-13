import { glyphClass, pieceGlyph } from '@ligungi/board';
import type { Color, Role } from '@ligungi/engine';
import { useT } from '../i18n/index.ts';
import { prefs } from '../prefs.ts';
import { useStore } from '../store.ts';

const SAMPLE: ReadonlyArray<readonly [Role, Color]> = [
  ['marshal', 'white'],
  ['general', 'white'],
  ['lancer', 'white'],
  ['archer', 'white'],
  ['spy', 'black'],
];

/** A few pieces drawn exactly as on the board with the current style and movement indicators. */
export const PiecePreview = () => {
  const t = useT();
  const { pieceStyle, moveGuides } = useStore(prefs);
  const layout = glyphClass(pieceStyle, moveGuides);
  return (
    <figure class="ligungi-piece-preview">
      <figcaption>{t.settings.piecePreview}</figcaption>
      <div class="ligungi-piece-preview__row gg-palette" aria-hidden="true">
        {SAMPLE.map(([role, color]) => (
          <div key={role} class="ligungi-piece-preview__sq">
            <div
              class={`gg-piece gg-${color} gg-top${color === 'black' ? ' gg-flipped' : ''}${layout ? ` ${layout}` : ''}`}
              dangerouslySetInnerHTML={{ __html: `<span>${pieceGlyph(role, pieceStyle, moveGuides)}</span>` }}
            />
          </div>
        ))}
      </div>
    </figure>
  );
};

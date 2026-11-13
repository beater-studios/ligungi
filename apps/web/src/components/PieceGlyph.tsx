import { pieceGlyph } from '@ligungi/board';
import type { Role } from '@ligungi/engine';
import { prefs } from '../prefs.ts';
import { useStore } from '../store.ts';

/**
 * A piece's kanji or icon in the style the viewer chose, for the static places (piece panel, mini boards). The markup
 * comes from the board package's constant icons and kanji, never from user input.
 */
export const PieceGlyph = ({ role, guides = false }: { role: Role; guides?: boolean }) => {
  const { pieceStyle } = useStore(prefs);
  return <span class="ligungi-glyph" dangerouslySetInnerHTML={{ __html: pieceGlyph(role, pieceStyle, guides) }} />;
};

import { pieceGlyph } from '@ligungi/board';
import type { Role } from '@ligungi/engine';
import { usePieceNames } from '../i18n/index.ts';
import { guidesShown, prefs } from '../prefs.ts';
import { useStore } from '../store.ts';

/**
 * A piece's kanji or icon in the style the viewer chose, for the static places (piece panel, mini boards). The markup
 * comes from the board package's constant icons and kanji, never from user input.
 */
export const PieceGlyph = ({ role, guides = false }: { role: Role; guides?: boolean }) => {
  const current = useStore(prefs);
  const names = usePieceNames();
  const withGuides = guides && guidesShown({ moveGuides: true, pieceShape: current.pieceShape });
  return <span class="ligungi-glyph" dangerouslySetInnerHTML={{ __html: pieceGlyph(role, current.pieceStyle, withGuides, names) }} />;
};

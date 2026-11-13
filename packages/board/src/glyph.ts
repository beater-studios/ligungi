import { ROLE_INFO, type Role } from '@ligungi/engine';
import { guideMarks, guidesSvg } from './guides.ts';
import { PIECE_ICONS } from './icons.ts';

export type PieceStyle = 'kanji' | 'illustrated';

/** Without the movement guides around it, the icon can grow to fill the disc. */
const ICON_ALONE_SCALE = 1.45;

/**
 * Markup inside a piece's disc: the kanji or the icon of the style, with or without the movement guides. Shared by
 * the board, the piece panel and the static mini boards so a piece looks the same everywhere.
 */
export const pieceGlyph = (role: Role, style: PieceStyle, guides: boolean): string => {
  if (style === 'illustrated') {
    const art = `<g class="gg-art">${PIECE_ICONS[role]}</g>`;
    const icon = guides ? art : `<g transform="scale(${ICON_ALONE_SCALE})">${art}</g>`;
    return `<svg class="gg-icon" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><g fill="currentColor">${guides ? guideMarks(role) : ''}${icon}</g></svg>`;
  }
  return guides ? `${guidesSvg(role)}${ROLE_INFO[role].kanji}` : ROLE_INFO[role].kanji;
};

/** Class of a piece's disc for the layout of its glyph. */
export const glyphClass = (style: PieceStyle, guides: boolean): string =>
  style === 'illustrated' ? 'gg-illustrated' : guides ? 'gg-guided' : '';

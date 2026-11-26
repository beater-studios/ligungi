import { ROLE_INFO, type Role } from '@ligungi/engine';
import { escapeHtml } from './escape.ts';
import { guideMarks, guidesSvg } from './guides.ts';
import { PIECE_ICONS, TRACE_ICONS } from './icons.ts';
import { ENGLISH_PIECE_NAMES, pieceLetters, type PieceNames } from './labels.ts';

/**
 * What a piece shows: `kanji` as on the physical game, `illustrated` an icon, `trace` the same icon as outlines, and
 * `letters` a two-letter abbreviation of its name.
 */
export type PieceStyle = 'kanji' | 'illustrated' | 'trace' | 'letters';

export const PIECE_STYLES: readonly PieceStyle[] = ['illustrated', 'trace', 'kanji', 'letters'];

/** Without the movement guides around it, the icon can grow to fill the disc. */
const ICON_ALONE_SCALE = 1.45;

const iconSvg = (role: Role, trace: boolean, guides: boolean): string => {
  const art = `<g class="gg-art">${(trace && TRACE_ICONS[role]) || PIECE_ICONS[role]}</g>`;
  const icon = guides ? art : `<g transform="scale(${ICON_ALONE_SCALE})">${art}</g>`;
  const className = trace ? 'gg-icon gg-trace' : 'gg-icon';
  return `<svg class="${className}" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><g fill="currentColor">${guides ? guideMarks(role) : ''}${icon}</g></svg>`;
};

/**
 * Markup inside a piece's disc: the kanji, icon or letters of the style, with or without the movement guides. Shared by
 * the board, the piece panel and the static mini boards so a piece looks the same everywhere. `names` picks the
 * language of the letters style.
 */
export const pieceGlyph = (role: Role, style: PieceStyle, guides: boolean, names: PieceNames = ENGLISH_PIECE_NAMES): string => {
  if (style === 'illustrated' || style === 'trace') return iconSvg(role, style === 'trace', guides);
  const text = style === 'letters' ? `<b class="gg-letters">${escapeHtml(pieceLetters(role, names))}</b>` : ROLE_INFO[role].kanji;
  return guides ? `${guidesSvg(role)}${text}` : text;
};

/** Class of a piece's disc for the layout of its glyph. */
export const glyphClass = (style: PieceStyle, guides: boolean): string =>
  style === 'illustrated' || style === 'trace' ? 'gg-illustrated' : guides ? 'gg-guided' : '';

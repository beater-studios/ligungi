import { contrast, mixColors } from './boardColors.ts';

/** The custom piece palette: the face and the ink (kanji, icon or letters) of each side. */
export interface CustomPieces {
  readonly whiteFace: string;
  readonly whiteInk: string;
  readonly blackFace: string;
  readonly blackInk: string;
}

/** The ivory and ebony of the default palette. */
export const DEFAULT_CUSTOM_PIECES: CustomPieces = { whiteFace: '#f6f1e7', whiteInk: '#1b1b1b', blackFace: '#232323', blackInk: '#f4f1ea' };

/** WCAG's minimum for large text: the glyph fills most of the piece. */
const MIN_INK_CONTRAST = 3;
/** Below this the two sides are told apart by their ink only. */
const MIN_SIDES_CONTRAST = 1.6;

export type PieceWarning = 'whiteInk' | 'blackInk' | 'sidesAlike';

export interface CustomPieceStyle {
  /** CSS custom properties (`--gg-custom-white-*`, `--gg-custom-black-*`) for the page root. */
  readonly vars: Readonly<Record<string, string>>;
  readonly warnings: readonly PieceWarning[];
}

/** From a face color, the lighter shine and the darker rim that give a piece its volume. */
const side = (prefix: string, face: string, ink: string): Record<string, string> => ({
  [`--gg-custom-${prefix}-face`]: face,
  [`--gg-custom-${prefix}-shine`]: mixColors(face, '#ffffff', 0.35),
  [`--gg-custom-${prefix}-rim`]: mixColors(face, '#000000', 0.25),
  [`--gg-custom-${prefix}-ink`]: ink,
});

export const customPieceStyle = (pieces: CustomPieces): CustomPieceStyle => {
  const warnings: PieceWarning[] = [];
  if (contrast(pieces.whiteFace, pieces.whiteInk) < MIN_INK_CONTRAST) warnings.push('whiteInk');
  if (contrast(pieces.blackFace, pieces.blackInk) < MIN_INK_CONTRAST) warnings.push('blackInk');
  if (contrast(pieces.whiteFace, pieces.blackFace) < MIN_SIDES_CONTRAST) warnings.push('sidesAlike');
  return {
    vars: { ...side('white', pieces.whiteFace, pieces.whiteInk), ...side('black', pieces.blackFace, pieces.blackInk) },
    warnings,
  };
};

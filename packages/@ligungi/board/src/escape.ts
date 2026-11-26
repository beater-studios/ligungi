import type { Color } from '@ligungi/engine';

/**
 * Text for markup: names and labels come from translations, so `&`, `<`, `>` and quotes are turned into entities before
 * going into `innerHTML` or an attribute.
 */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** A color for class names and attributes: the board is a library, so a value it is given is never trusted as markup. */
export const safeColor = (value: string): Color => (value === 'black' ? 'black' : 'white');

/** A whole number for inline styles (tower heights and levels), so nothing else can reach the markup. */
export const safeInt = (value: number): number => (Number.isFinite(value) ? Math.trunc(value) : 0);

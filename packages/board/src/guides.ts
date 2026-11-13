import { MOVE_RULES, type MoveRule, type Role } from '@ligungi/engine';

/**
 * Movement guides of the beginner piece set: marks around the kanji that show where the piece moves at tier 1,
 * generated from the engine's rules so they always match them. Drawn from the mover's point of view (forward is
 * up), inside the disc, so the board's 180° turn for the opponent's pieces applies to them too.
 *
 * - a dot per square of reach (one or two),
 * - an arrow for an unlimited line,
 * - a ring where a jumping piece lands, with small ticks on the squares it jumps over.
 */

/** Distance from the center, in a 100-unit disc, of the mark for the d-th square along a direction. */
const radius = (d: number): number => 29 + (d - 1) * 8.5;

const point = (dir: readonly [number, number], r: number): [number, number] => {
  const length = Math.hypot(dir[0], dir[1]);
  return [(dir[0] / length) * r, (-dir[1] / length) * r];
};

const fixed = (n: number): string => n.toFixed(1);

const dot = (dir: readonly [number, number], d: number): string => {
  const [x, y] = point(dir, radius(d));
  return `<circle cx="${fixed(x)}" cy="${fixed(y)}" r="3.6"/>`;
};

const tick = (dir: readonly [number, number], d: number): string => {
  const [x, y] = point(dir, radius(d));
  return `<circle cx="${fixed(x)}" cy="${fixed(y)}" r="1.8" opacity="0.6"/>`;
};

const ring = (dir: readonly [number, number], r: number): string => {
  const [x, y] = point(dir, r);
  return `<circle cx="${fixed(x)}" cy="${fixed(y)}" r="3.8" fill="none" stroke="currentColor" stroke-width="2.2"/>`;
};

const arrow = (dir: readonly [number, number]): string => {
  const [x1, y1] = point(dir, radius(1) - 3);
  const [x2, y2] = point(dir, 45);
  const [bx, by] = point(dir, 38);
  const [px, py] = point([-dir[1], dir[0]], 4.5);
  return (
    `<line x1="${fixed(x1)}" y1="${fixed(y1)}" x2="${fixed(bx)}" y2="${fixed(by)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>` +
    `<polygon points="${fixed(x2)},${fixed(y2)} ${fixed(bx + px)},${fixed(by + py)} ${fixed(bx - px)},${fixed(by - py)}"/>`
  );
};

const marks = (rule: MoveRule): string => {
  if (rule.type === 'slide') {
    if (rule.base === Infinity) return arrow(rule.dir);
    return Array.from({ length: rule.base }, (_, i) => dot(rule.dir, i + 1)).join('');
  }
  if (rule.type === 'jump') {
    return Array.from({ length: rule.base }, (_, i) =>
      i + 1 < rule.min ? tick(rule.dir, i + 1) : ring(rule.dir, radius(i + 1)),
    ).join('');
  }
  // The archer's volley lands one square to the side and two ahead at tier 1.
  return ring([1, 2], radius(2)) + ring([-1, 2], radius(2));
};

const cache = new Map<Role, string>();

/** The marks of a role's movement guides, as SVG elements in the 100-unit disc (cached per role). */
export const guideMarks = (role: Role): string => {
  let markup = cache.get(role);
  if (!markup) {
    markup = MOVE_RULES[role].map(marks).join('');
    cache.set(role, markup);
  }
  return markup;
};

/** Inline SVG of a role's movement guides (`currentColor`), to lay over a kanji. */
export const guidesSvg = (role: Role): string =>
  `<svg class="gg-guides" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><g fill="currentColor">${guideMarks(role)}</g></svg>`;

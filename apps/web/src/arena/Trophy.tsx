import type { TrophyKind } from '@ligungi/protocol';
import { useT } from '../i18n/index.ts';

/** Each metal: the top face and the side of its discs. */
const METALS = {
  gold: ['#f3cd5b', '#b5861c'],
  silver: ['#e4e7eb', '#959ca5'],
  bronze: ['#e3a46c', '#975a2a'],
  blue: ['#7db8f0', '#2f6fae'],
} as const;

/** The place is the height of the tower, as in Gungi: three discs for the champion, two for second, one for third. */
const LOOK: Record<TrophyKind, { readonly discs: number; readonly metal: keyof typeof METALS; readonly scale: number }> = {
  arenaChampion: { discs: 3, metal: 'gold', scale: 1 },
  arenaSecond: { discs: 2, metal: 'silver', scale: 1 },
  arenaThird: { discs: 1, metal: 'bronze', scale: 1 },
  arenaTop: { discs: 1, metal: 'blue', scale: 0.72 },
};

const Disc = ({ y, top, side }: { y: number; top: string; side: string }) => (
  <g>
    <ellipse cx="32" cy={y + 8.5} rx="24" ry="8.5" fill={side} />
    <rect x="8" y={y} width="48" height="8.5" fill={side} />
    <ellipse cx="32" cy={y} rx="24" ry="8.5" fill={top} />
    <ellipse cx="25" cy={y - 2} rx="8" ry="2.4" fill="#fff" opacity="0.32" />
  </g>
);

/**
 * An Arena trophy: a tower of discs in gold, silver or bronze, or a smaller blue disc for the top 10%. `title` is what a
 * pointer over it shows (the place and the Arena); without it, the trophy's name.
 */
export const Trophy = ({ kind, size = 48, title }: { kind: TrophyKind; size?: number; title?: string }) => {
  const t = useT();
  const look = LOOK[kind];
  const [top, side] = METALS[look.metal];
  const label = title ?? t.arena.trophies[kind];
  const drawn = Math.round(size * look.scale);
  return (
    <span class="ligungi-trophy" style={{ width: `${size}px`, height: `${size}px` }} title={label}>
      <svg width={drawn} height={drawn} viewBox="0 0 64 64" role="img" aria-label={label}>
        <ellipse cx="32" cy="60" rx={look.scale < 1 ? 18 : 22} ry="3" fill="#000" opacity="0.22" />
        {[41.5, 29.5, 17.5].slice(0, look.discs).map((y) => (
          <Disc key={y} y={y} top={top} side={side} />
        ))}
      </svg>
    </span>
  );
};

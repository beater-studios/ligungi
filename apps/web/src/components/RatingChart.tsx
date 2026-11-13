import { RATING_BAND, type RatingBand } from '@ligungi/protocol';
import { useT } from '../i18n/index.ts';

/** Drawing sizes: the figure scales to its box, so a narrow column gets a smaller drawing to keep the text legible. */
const SIZES = { large: { width: 640, height: 200, ticks: 8 }, compact: { width: 320, height: 150, ticks: 4 } } as const;
const PAD = { top: 22, right: 8, bottom: 26, left: 8 };

/** Bar path with rounded top corners only: the bar stays anchored to the baseline. */
const bar = (x: number, y: number, w: number, h: number): string => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/**
 * Histogram of players per rating band, with the viewer's band marked by color and a label (never color alone).
 * Every band has a native tooltip, and the figure carries a text summary for screen readers.
 */
export const RatingChart = ({
  bands,
  you,
  label,
  size = 'large',
}: {
  bands: readonly RatingBand[];
  you: number | null;
  label: string;
  size?: keyof typeof SIZES;
}) => {
  const t = useT();
  const { width, height, ticks } = SIZES[size];
  if (bands.length === 0) return null;
  const first = bands[0]!.from;
  const last = bands[bands.length - 1]!.from;
  const yourBand = you === null ? null : Math.floor(you / RATING_BAND) * RATING_BAND;
  // Empty bands between the lowest and highest keep their place, so gaps in the field stay visible.
  const counts = new Map(bands.map((band) => [band.from, band.players]));
  const columns: RatingBand[] = [];
  for (let from = Math.min(first, yourBand ?? first); from <= Math.max(last, yourBand ?? last); from += RATING_BAND) {
    columns.push({ from, players: counts.get(from) ?? 0 });
  }
  const max = Math.max(...columns.map((column) => column.players));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const step = innerW / columns.length;
  const gap = Math.min(2, step / 4);
  const labelEvery = Math.max(1, Math.ceil(columns.length / ticks));
  return (
    <figure class={`ligungi-dist ligungi-dist--${size}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {/* A path, not <line>: lila uses <line> as a custom element, declared in lila-elements.d.ts. */}
        <path class="ligungi-dist__base" d={`M${PAD.left},${PAD.top + innerH}H${width - PAD.right}`} />
        {columns.map((column, index) => {
          const x = PAD.left + index * step + gap / 2;
          const h = max === 0 ? 0 : (column.players / max) * innerH;
          const mine = column.from === yourBand;
          return (
            <g key={column.from} class={mine ? 'ligungi-dist__you' : ''}>
              <title>{t.players.band(column.from, column.from + RATING_BAND - 1, column.players)}</title>
              {/* A full-height target, so thin or empty bands are easy to hover. */}
              <rect class="ligungi-dist__hit" x={x - gap / 2} y={PAD.top} width={step} height={innerH} />
              {h > 0 && <path class="ligungi-dist__bar" d={bar(x, PAD.top + innerH - h, step - gap, h)} />}
              {mine && (
                <text class="ligungi-dist__marker" x={x + (step - gap) / 2} y={Math.max(12, PAD.top + innerH - h - 6)} text-anchor="middle">
                  {t.players.you}
                </text>
              )}
              {index % labelEvery === 0 && (
                <text class="ligungi-dist__tick" x={x} y={height - 8}>
                  {column.from}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
};

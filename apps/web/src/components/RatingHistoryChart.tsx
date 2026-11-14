import type { RatingPoint } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDate, useT } from '../i18n/index.ts';

/** Until the figure is measured; then the drawing takes its width, so one unit is one pixel and text keeps its size. */
const DEFAULT_WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 14, right: 14, bottom: 28, left: 44 };
/** Dots on every game only while they stay apart; a long history is the line alone. */
const MAX_DOTS = 40;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Gridline step that gives at most five lines over the range. */
const tickStep = (range: number) => [25, 50, 100, 200, 500].find((step) => range / step <= 5) ?? 1000;

/**
 * A player's rating after each rated game, over time: one line, a recessive grid, and a crosshair with the game's date,
 * rating and change under the pointer (mouse or touch). The figure's label summarizes it for screen readers; the page
 * offers the points as a table too.
 */
export const RatingHistoryChart = ({ points, label }: { points: readonly RatingPoint[]; label: string }) => {
  const t = useT();
  const svg = useRef<SVGSVGElement>(null);
  const figure = useRef<HTMLElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [WIDTH, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = figure.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [points.length === 0]);
  if (points.length === 0) return null;

  const ratings = points.map((point) => point.rating);
  const step = tickStep(Math.max(...ratings) - Math.min(...ratings) + 40);
  const low = Math.floor((Math.min(...ratings) - 20) / step) * step;
  const high = Math.ceil((Math.max(...ratings) + 20) / step) * step;
  const first = points[0]!.at;
  const last = points[points.length - 1]!.at;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (at: number) => (last === first ? PAD.left + innerW / 2 : PAD.left + ((at - first) / (last - first)) * innerW);
  const y = (rating: number) => PAD.top + ((high - rating) / (high - low)) * innerH;
  const line = points.map((point, i) => `${i ? 'L' : 'M'}${x(point.at).toFixed(1)},${y(point.rating).toFixed(1)}`).join('');
  const ticks: number[] = [];
  for (let value = low; value <= high; value += step) ticks.push(value);

  /** The game nearest to the pointer along the time axis. */
  const pick = (event: PointerEvent) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const at = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    points.forEach((point, i) => {
      if (Math.abs(x(point.at) - at) < Math.abs(x(points[nearest]!.at) - at)) nearest = i;
    });
    setActive(nearest);
  };

  const shown = active === null ? null : points[active]!;
  return (
    <figure class="ligungi-history-chart" ref={figure}>
      <svg
        ref={svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((value) => (
          <g key={value}>
            {/* Paths, not <line>: lila uses <line> as a custom element, declared in lila-elements.d.ts. */}
            <path class="ligungi-history-chart__grid" d={`M${PAD.left},${y(value)}H${WIDTH - PAD.right}`} />
            <text class="ligungi-history-chart__tick" x={PAD.left - 8} y={y(value) + 4} text-anchor="end">
              {value}
            </text>
          </g>
        ))}
        <text class="ligungi-history-chart__tick" x={PAD.left} y={HEIGHT - 8}>
          {formatDate(t, first)}
        </text>
        {last !== first && (
          <text class="ligungi-history-chart__tick" x={WIDTH - PAD.right} y={HEIGHT - 8} text-anchor="end">
            {formatDate(t, last)}
          </text>
        )}
        <path class="ligungi-history-chart__line" d={line} />
        {points.length <= MAX_DOTS &&
          points.map((point) => <circle key={point.gameId} class="ligungi-history-chart__dot" cx={x(point.at)} cy={y(point.rating)} r={3.5} />)}
        {shown && (
          <>
            <path class="ligungi-history-chart__cross" d={`M${x(shown.at)},${PAD.top}V${PAD.top + innerH}`} />
            <circle class="ligungi-history-chart__active" cx={x(shown.at)} cy={y(shown.rating)} r={5} />
          </>
        )}
        {/* The whole plot answers the pointer, so thin lines and lone points are easy to reach. */}
        <rect class="ligungi-history-chart__hit" x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
      </svg>
      {shown && (
        <div
          class={`ligungi-history-chart__tip${x(shown.at) > WIDTH / 2 ? ' is-left' : ''}`}
          style={{ left: `${(x(shown.at) / WIDTH) * 100}%`, top: `${(y(shown.rating) / HEIGHT) * 100}%` }}
          role="status"
        >
          <strong>{shown.rating}</strong> <span>{signed(shown.change)}</span>
          <small>{formatDate(t, shown.at)}</small>
        </div>
      )}
    </figure>
  );
};

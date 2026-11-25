import type { ExplorerStats } from '@ligungi/protocol';
import { useT } from '../i18n/index.ts';

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/** White wins, draws and Black wins as one bar, with the shares written in it when there is room. */
export const ResultBar = ({ stats }: { stats: ExplorerStats }) => {
  const t = useT();
  const shares = [
    { key: 'white', value: percent(stats.white, stats.games) },
    { key: 'draws', value: percent(stats.draws, stats.games) },
    { key: 'black', value: percent(stats.black, stats.games) },
  ];
  return (
    <span class="ligungi-explorer__bar" role="img" aria-label={t.explorer.resultsLabel(shares[0]!.value, shares[1]!.value, shares[2]!.value)}>
      {shares.map(({ key, value }) =>
        value > 0 ? (
          <span key={key} class={`is-${key}`} style={{ width: `${value}%` }}>
            {value >= 25 ? `${value}%` : ''}
          </span>
        ) : null,
      )}
    </span>
  );
};

import { useT } from '../i18n/index.ts';

/** How much a rating moved over the last week, as on lichess's leaderboards; nothing when it did not move. */
export const RatingTrend = ({ value }: { value: number }) => {
  const t = useT();
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span class={`ligungi-trend ${up ? 'is-up' : 'is-down'}`} title={t.ranking.trendLabel(value)} aria-label={t.ranking.trendLabel(value)}>
      <span aria-hidden="true">
        {up ? '▲' : '▼'}
        {Math.abs(value)}
      </span>
    </span>
  );
};

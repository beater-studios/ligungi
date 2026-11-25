import type { Crosstable as CrosstableData } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { useT } from '../i18n/index.ts';

/** The record between two players: the score, the draws and the latest results from the first player's side. */
export const CrosstableView = ({ data, allHref }: { data: CrosstableData; allHref?: string }) => {
  const t = useT();
  const [first, second] = data.users;
  return (
    <section class="ligungi-card ligungi-crosstable">
      <h2>{t.crosstable.title}</h2>
      <p class="ligungi-crosstable__score">
        <a href={`/@/${first.name}`}>{first.name}</a>
        <strong>
          {data.wins[0]} – {data.wins[1]}
        </strong>
        <a href={`/@/${second.name}`}>{second.name}</a>
        {data.draws > 0 && <span class="ligungi-crosstable__draws">{t.crosstable.draws(data.draws)}</span>}
      </p>
      <ol class="ligungi-crosstable__recent" aria-label={t.crosstable.recent}>
        {data.recent.map((game) => {
          const result = game.winner === null ? 'draw' : game.winner === 0 ? 'win' : 'loss';
          const label = game.winner === null ? t.crosstable.draw : t.crosstable.win(data.users[game.winner].name);
          return (
            <li key={game.id}>
              <a class={`is-${result}`} href={`/${game.id}`} title={label} aria-label={label}>
                {game.winner === null ? '½' : game.winner === 0 ? '1' : '0'}
              </a>
            </li>
          );
        })}
      </ol>
      {allHref && (
        <a class="ligungi-crosstable__all" href={allHref}>
          {t.crosstable.all}
        </a>
      )}
    </section>
  );
};

/**
 * Loads and shows the record between two players, from `a`'s side; nothing while they never finished a game together.
 * `version` reloads it, so a game page shows the new result once the game ends.
 */
export const Crosstable = ({ a, b, version, allHref }: { a: string; b: string; version?: string; allHref?: string }) => {
  const pair = `${a}/${b}`;
  const [loaded, setLoaded] = useState<{ pair: string; data: CrosstableData } | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<CrosstableData>(`/api/crosstable/${encodeURIComponent(a)}/${encodeURIComponent(b)}`)
      .then((data) => alive && setLoaded({ pair, data }))
      .catch(() => alive && setLoaded(null));
    return () => {
      alive = false;
    };
  }, [pair, version]);
  // Another pair's record never shows while this one loads (moving from one game or profile to the next).
  const data = loaded?.pair === pair ? loaded.data : null;
  if (!data || data.wins[0] + data.wins[1] + data.draws === 0) return null;
  return <CrosstableView data={data} {...(allHref ? { allHref } : {})} />;
};

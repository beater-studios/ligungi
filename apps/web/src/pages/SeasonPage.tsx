import { seasonRange, type SeasonView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { arenaTime, nextSeason, previousSeason, seasonLabel } from '../arena/arena.ts';
import { Trophy } from '../arena/Trophy.tsx';
import { api } from '../core/api.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';
import { formatDate, useT } from '../i18n/index.ts';

/**
 * A season's standings: each player's results Arena by Arena, the ones that count highlighted, and the sum of the best
 * half. Once the season is over, its champion with the season trophy. Without `id`, the season running now.
 */
export const SeasonPage = ({ id }: { id?: string }) => {
  const t = useT();
  const a = t.arena;
  const { user } = useStore(session);
  const [view, setView] = useState<SeasonView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    setView(null);
    setMissing(false);
    api
      .get<SeasonView>(id ? `/api/arena/season/${id}` : '/api/arena/season')
      .then((season) => live && setView(season))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (!view) {
    return (
      <main class="ligungi-page ligungi-arena">
        <section class="ligungi-card ligungi-arena__head">
          <div class="ligungi-arena__title">
            <Trophy kind="seasonChampion" size={44} />
            <h1>{a.seasonStandings}</h1>
          </div>
        </section>
        <p class="ligungi-notice">{missing ? t.errors.seasonNotFound : t.common.loading}</p>
      </main>
    );
  }
  const total = view.arenas.length + view.upcoming.length;
  const champion = view.standings.find((s) => s.champion);
  const previous = previousSeason(view.season);
  const following = nextSeason(view.season);
  const nextArena = view.upcoming[0];
  return (
    <main class="ligungi-page ligungi-arena ligungi-season">
      <section class="ligungi-card ligungi-arena__head">
        <div class="ligungi-arena__title">
          <Trophy kind="seasonChampion" size={52} />
          <div>
            <h1>
              {seasonLabel(t, view.season)}
              {view.season === 'S0' && <span class="ligungi-season__founders">{a.founders}</span>}
            </h1>
            <span class="ligungi-arena__meta">
              {[`${formatDate(t, view.from)} · ${formatDate(t, view.to - 1)}`, a.seasonPlayed(view.arenas.length, total), a.playersCount(view.standings.length)].join(' · ')}
            </span>
          </div>
        </div>
        <nav class="ligungi-season__nav" aria-label={a.seasonsNav}>
          {previous && <a href={`/arena/season/${previous}`}>{seasonLabel(t, previous)}</a>}
          {seasonRange(following).from <= Date.now() && <a href={`/arena/season/${following}`}>{seasonLabel(t, following)}</a>}
        </nav>
      </section>

      <section class="ligungi-card ligungi-arena__facts">
        <p>{a.seasonRule(view.counted, view.arenas.length)}</p>
        {champion ? (
          <p class="ligungi-arena__prize">
            <Trophy kind="seasonChampion" size={28} />
            {a.seasonChampion(champion.user.name, champion.points)}
          </p>
        ) : view.over ? (
          <p class="ligungi-arena__note">{a.seasonNoChampion}</p>
        ) : (
          nextArena && <p class="ligungi-arena__note">{a.seasonLeft(view.upcoming.length, arenaTime(t, nextArena.startsAt))}</p>
        )}
      </section>

      {view.standings.length === 0 ? (
        <p class="ligungi-card ligungi-arena__canceled">{a.seasonEmpty}</p>
      ) : (
        <section class="ligungi-card ligungi-arena__table">
          <table>
            <caption>{a.seasonStandings}</caption>
            <thead>
              <tr>
                <th scope="col">{a.rank}</th>
                <th scope="col">{a.player}</th>
                <th scope="col">{a.seasonResults}</th>
                <th scope="col" class="num">
                  {a.points}
                </th>
              </tr>
            </thead>
            <tbody>
              {view.standings.map((s) => (
                <tr key={s.user.id} class={s.user.id === user?.id ? 'is-you' : ''}>
                  <td class="rank">{s.rank}</td>
                  <td>
                    <span class="ligungi-arena__player">
                      <a href={`/@/${s.user.name}`}>{s.user.name}</a>
                      {s.champion && <Trophy kind="seasonChampion" size={22} />}
                    </span>
                  </td>
                  <td>
                    <span class="ligungi-season__results">
                      {s.results.map((r, i) => (
                        <a key={view.arenas[i]!.id} href={`/arena/${view.arenas[i]!.id}`} class={r.score === null ? 'is-missing' : r.counted ? 'is-counted' : ''}
                          title={formatDate(t, view.arenas[i]!.startsAt)}
                          aria-label={`${formatDate(t, view.arenas[i]!.startsAt)}: ${r.score === null ? a.resultMissing : `${r.score}, ${r.counted ? a.resultCounts : a.resultNotCounted}`}`}
                        >
                          {r.score ?? '-'}
                        </a>
                      ))}
                    </span>
                  </td>
                  <td class="num">
                    <strong>{s.points}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="ligungi-arena__note">{a.seasonLegend}</p>
        </section>
      )}
      <p>
        <a class="button" href="/arena">
          {a.seeNext}
        </a>
      </p>
    </main>
  );
};

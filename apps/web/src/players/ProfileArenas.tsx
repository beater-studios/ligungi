import type { ArenaList, PlayerArenas } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { arenaTime, trophyTitle } from '../arena/arena.ts';
import { Trophy } from '../arena/Trophy.tsx';
import { api } from '../core/api.ts';
import { formatDate, useT } from '../i18n/index.ts';

/**
 * A player's tournaments on their profile: the trophy counts, the latest trophies (each with its place and date on
 * hover) and the latest Arenas played. Participation is a count, never an icon.
 */
export const ProfileArenas = ({ name, own }: { name: string; own: boolean }) => {
  const t = useT();
  const a = t.arena;
  const [data, setData] = useState<PlayerArenas | null>(null);
  const [next, setNext] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    api
      .get<PlayerArenas>(`/api/users/${encodeURIComponent(name)}/arenas`)
      .then((result) => alive && setData(result))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name]);
  useEffect(() => {
    if (!own || !data || data.counts.arenas > 0) return;
    api
      .get<ArenaList>('/api/arena')
      .then((list) => setNext(list.current?.startsAt ?? null))
      .catch(() => {});
  }, [own, data]);
  if (!data) return null;
  const { counts } = data;
  if (counts.arenas === 0) {
    // Someone else's empty record says nothing worth a card; the player's own one points to the next Arena.
    if (!own) return null;
    return (
      <section class="ligungi-card ligungi-profile-arenas">
        <h2>{a.profileTitle}</h2>
        <p>{next ? a.profileEmptyYou(arenaTime(t, next)) : a.profileEmpty}</p>
        <a class="button" href="/arena">
          {a.seeNext}
        </a>
      </section>
    );
  }
  const summary = [
    counts.champion ? a.champions(counts.champion) : null,
    counts.podium ? a.podiums(counts.podium) : null,
    counts.top ? a.tops(counts.top) : null,
    a.played(counts.arenas),
  ].filter(Boolean);
  return (
    <section class="ligungi-card ligungi-profile-arenas">
      <div class="ligungi-profile-arenas__head">
        <h2>{a.profileTitle}</h2>
        <span>{summary.join(' · ')}</span>
      </div>
      {data.trophies.length > 0 && (
        <div class="ligungi-profile-arenas__trophies">
          <h3>{a.recentTrophies}</h3>
          <ul>
            {data.trophies.map((trophy) => (
              <li key={`${trophy.arena}-${trophy.kind}`}>
                <a href={`/arena/${trophy.arena}`}>
                  <Trophy kind={trophy.kind} size={56} title={trophyTitle(t, trophy)} />
                  <span>{a.place(trophy.place, trophy.players)}</span>
                  <small>{formatDate(t, trophy.at)}</small>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div class="ligungi-profile-arenas__history">
        <h3>{a.history}</h3>
        <table>
          <thead>
            <tr>
              <th scope="col">{a.date}</th>
              <th scope="col" class="num">{a.placeColumn}</th>
              <th scope="col" class="num">{a.games}</th>
              <th scope="col" class="num">{a.points}</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((row) => (
              <tr key={row.arena}>
                <td>
                  <a href={`/arena/${row.arena}`}>{formatDate(t, row.at)}</a>
                </td>
                <td class="num">{a.place(row.rank, row.players)}</td>
                <td class="num">{row.games}</td>
                <td class="num">
                  <strong>{row.score}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

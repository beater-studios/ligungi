import { pieceName } from '@ligungi/board';
import { MODES, ROLES, type Mode } from '@ligungi/engine';
import { PACES, type InsightsView, type UserProfile } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { RecordRow } from '../players/RatingHistory.tsx';
import { usePieceNames, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../core/router.ts';

const RESULTS = ['win', 'draw', 'loss'] as const;

/**
 * A player's rated games of one mode looked at from several sides: the opponent's strength, how the games end, the
 * pace, their length, the most played opponents and, in the draft modes, the pieces placed and held back.
 */
export const InsightsPage = ({ name }: { name: string }) => {
  const t = useT();
  const i = t.insights;
  const names = usePieceNames();
  const { search } = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<InsightsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<UserProfile>(`/api/users/${name}`)
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
  }, [name]);

  const played = profile ? MODES.filter((m) => {
    const record = profile.records[m];
    return record.wins + record.draws + record.losses > 0;
  }) : [];
  const asked = new URLSearchParams(search).get('mode') as Mode | null;
  const mode: Mode | null = asked && (MODES as readonly string[]).includes(asked) ? asked : (played[0] ?? null);

  useEffect(() => {
    if (!mode) return;
    setView(null);
    api
      .get<InsightsView>(`/api/users/${name}/insights/${mode}`)
      .then(setView)
      .catch((err: Error) => setError(err.message));
  }, [name, mode]);

  const userName = profile?.user.name ?? name;
  const endingText = (counts: InsightsView['endings']['win']) => {
    const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
    return entries.length ? entries.map(([reason, count]) => `${t.reasons[reason as keyof typeof t.reasons]} ${count}`).join(' · ') : i.noEnding;
  };

  return (
    <main class="ligungi-page ligungi-insights">
      <section class="ligungi-card ligungi-insights__head">
        <a class="text" href={`/@/${userName}`} data-icon={icons.LessThan}>
          {i.back}
        </a>
        <h1>{i.title(userName)}</h1>
        <p class="ligungi-insights__intro">{i.intro}</p>
        <div class="ligungi-segmented" role="group" aria-label={t.common.mode}>
          {MODES.map((m) => (
            <button key={m} type="button" class={m === mode ? 'active' : ''} aria-pressed={m === mode} onClick={() => navigate(`/@/${userName}/insights?mode=${m}`, true)}>
              {t.modes[m]}
            </button>
          ))}
        </div>
      </section>
      {error && <p class="error">{error}</p>}
      {!error && mode && !view && <p class="ligungi-notice">{t.common.loading}</p>}
      {profile && !mode && <p class="ligungi-card ligungi-notice">{i.none}</p>}
      {view && view.games === 0 && <p class="ligungi-card ligungi-notice">{i.none}</p>}
      {view && view.games > 0 && (
        <div class="ligungi-insights__grid">
          <section class="ligungi-card ligungi-insights__card">
            <h2>{i.byOpponent}</h2>
            <p class="ligungi-insights__count">{i.games(view.games)}</p>
            {view.byOpponent.map((record, index) => (
              <RecordRow key={index} label={i.bands[index]!} record={record} />
            ))}
          </section>
          <section class="ligungi-card ligungi-insights__card">
            <h2>{i.endings}</h2>
            <dl class="ligungi-insights__list">
              {RESULTS.map((result) => (
                <div key={result}>
                  <dt>{i.endingOf[result]}</dt>
                  <dd>{endingText(view.endings[result])}</dd>
                </div>
              ))}
            </dl>
            <h2>{i.length}</h2>
            <dl class="ligungi-insights__list">
              {RESULTS.map((result) => (
                <div key={result}>
                  <dt>{i.lengthOf[result]}</dt>
                  <dd>{view.length[result] === null ? t.profile.noGamesHere : i.lengthValue(view.length[result]!)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section class="ligungi-card ligungi-insights__card">
            <h2>{i.byPace}</h2>
            {PACES.map((pace) => (
              <RecordRow key={pace} label={i.paces[pace]} record={view.byPace[pace]} />
            ))}
          </section>
          {view.opponents.length > 0 && (
            <section class="ligungi-card ligungi-insights__card">
              <h2>{i.opponents}</h2>
              {view.opponents.map((entry) => (
                <div key={entry.user.id} class="ligungi-insights__opponent">
                  <a href={`/@/${entry.user.name}`}>{entry.user.name}</a>
                  <RecordRow label="" record={entry.record} />
                </div>
              ))}
            </section>
          )}
          {view.draft && (
            <section class="ligungi-card ligungi-insights__card">
              <h2>{i.draft}</h2>
              <h3>{i.placed}</h3>
              <ul class="ligungi-insights__pieces">
                {ROLES.filter((role) => view.draft!.placed[role])
                  .sort((a, b) => view.draft!.placed[b]! - view.draft!.placed[a]!)
                  .map((role) => (
                    <li key={role}>
                      <span>{pieceName(role, names)}</span>
                      <strong>{view.draft!.placed[role]!.toLocaleString(t.locale)}</strong>
                    </li>
                  ))}
              </ul>
              <h3>{i.byHeld}</h3>
              {view.draft.byHeld.map((record, index) => (
                <RecordRow key={index} label={i.held[index]!} record={record} />
              ))}
            </section>
          )}
        </div>
      )}
    </main>
  );
};

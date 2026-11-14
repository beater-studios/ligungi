import type { ChallengeView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { playerName, timeControlText, useT } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { session } from '../session.ts';
import { socket } from '../socket.ts';
import { useStore } from '../store.ts';

export const ChallengePage = ({ id }: { id: string }) => {
  const t = useT();
  const { user } = useStore(session);
  const [challenge, setChallenge] = useState<ChallengeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<ChallengeView>(`/api/challenges/${id}`).then(setChallenge).catch((err: Error) => setError(err.message));
    const unsubscribe = socket.subscribe(`challenge:${id}`);
    const off = socket.on((message) => {
      if (message.t === 'challenge' && message.challenge.id === id) setChallenge(message.challenge);
    });
    return () => {
      unsubscribe();
      off();
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (challenge?.status === 'accepted' && challenge.gameId) navigate(`/${challenge.gameId}`, true);
  }, [challenge]);

  if (error)
    return (
      <main class="ligungi-page ligungi-challenge">
        <section class="ligungi-card ligungi-challenge__card">
          <h1>{t.challenge.title}</h1>
          <p class="error">{error}</p>
        </section>
      </main>
    );
  if (!challenge) return <main class="ligungi-page ligungi-challenge" />;

  const link = `${window.location.origin}/challenge/${challenge.id}`;
  const accept = async () => {
    try {
      const { gameId } = await api.post<{ gameId: string }>(`/api/challenges/${id}/accept`);
      navigate(`/${gameId}`, true);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const cancel = () => api.delete(`/api/challenges/${id}`).catch(() => {});
  const decline = () => api.post(`/api/challenges/${id}/decline`).catch((err: Error) => setError(err.message));
  const { destination } = challenge;
  const forMe = Boolean(destination?.user && destination.user.id === user?.id);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const { settings, challenger } = challenge;
  // Someone looking at a challenge meant for another player: describe it from the outside.
  const bystander = !challenge.mine && destination !== null && !forMe;
  // The challenger's colour choice, seen from the viewer: the receiver gets the other side.
  const myColor = challenge.mine || bystander || settings.color === 'random' ? settings.color : settings.color === 'white' ? 'black' : 'white';
  const label = challenge.mine
    ? destination
      ? t.challenge.yourDirect(destination.name)
      : t.challenge.yourLink
    : bystander
      ? t.challenge.title
      : t.challenge.received;
  const person = challenge.mine && destination ? destination : challenger;
  const personLink = (name: string) => (person.user ? <a href={`/@/${person.user.name}`}>{name}</a> : name);
  const tiles: Array<[string, string]> = [
    [t.common.mode, t.modes[settings.mode]],
    [t.challenge.time, timeControlText(t, settings.timeControl)],
    [t.challenge.type, `${settings.rated ? t.rated : t.casual}${settings.freeDraft ? ` · ${t.freeDraftTag}` : ''}`],
    [bystander ? t.challenge.challengerColor : t.common.yourColor, t.colorChoices[myColor]],
    [t.common.whoStarts, t.colorChoices[settings.firstPlayer]],
  ];

  return (
    <main class="ligungi-page ligungi-challenge">
      <section class="ligungi-card ligungi-challenge__card">
        <p class={`ligungi-challenge__label${challenge.mine || bystander ? '' : ' is-received'}`}>{label}</p>
        {challenge.mine && !destination ? (
          <h1>{t.challenge.linkTitle}</h1>
        ) : (
          <div class="ligungi-challenge__who">
            <span class="ligungi-avatar ligungi-avatar--large" aria-hidden="true">
              {playerName(t, person).slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1>
                {challenge.mine
                  ? personLink(playerName(t, person))
                  : bystander && destination
                    ? t.challenge.challengesOther(personLink(playerName(t, person)), destination.name)
                    : t.challenge.challengesYou(personLink(playerName(t, person)))}
              </h1>
              {person.rating !== null && <p>{t.challenge.rating(person.rating, t.modes[settings.mode])}</p>}
            </div>
          </div>
        )}

        <dl class="ligungi-challenge__tiles">
          {tiles.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {challenge.status === 'canceled' && <p class="ligungi-challenge__notice">{t.challenge.canceled}</p>}
        {challenge.status === 'declined' && (
          <p class="ligungi-challenge__notice">{challenge.mine && destination ? t.challenge.declinedBy(destination.name) : t.challenge.declined}</p>
        )}

        {challenge.status === 'open' && challenge.mine && !destination && (
          <div class="copy-me">
            <input
              class="copy-me__target"
              readOnly
              spellcheck={false}
              aria-label={t.challenge.linkLabel}
              value={link}
              onFocus={(e) => (e.target as HTMLInputElement).select()}
            />
            <button type="button" class="copy-me__button button" onClick={copy}>
              {copied ? t.challenge.copied : t.challenge.copy}
            </button>
          </div>
        )}
        {challenge.status === 'open' && challenge.mine && (
          <>
            <p class="ligungi-challenge__waiting" role="status">
              {destination ? t.challenge.waitingFor(destination.name) : t.challenge.waiting}
            </p>
            <button type="button" class="button button-empty button-red ligungi-challenge__cancel" onClick={cancel}>
              {t.challenge.cancel}
            </button>
          </>
        )}

        {challenge.status === 'open' && !challenge.mine && destination && !forMe && (
          <p class="ligungi-challenge__notice">{user ? t.challenge.forSomeoneElse : t.challenge.loginToAnswer}</p>
        )}
        {challenge.status === 'open' && !challenge.mine && (forMe || !destination) && (
          settings.rated && !user ? (
            <p class="ligungi-challenge__notice">{t.challenge.ratedLogin}</p>
          ) : (
            <div class={`ligungi-challenge__actions${forMe ? '' : ' is-single'}`}>
              <button type="button" class="button ligungi-button-good" onClick={accept}>
                {t.challenge.accept}
              </button>
              {forMe && (
                <button type="button" class="button button-empty button-red" onClick={decline}>
                  {t.challenge.decline}
                </button>
              )}
            </div>
          )
        )}
      </section>
    </main>
  );
};

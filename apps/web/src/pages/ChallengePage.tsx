import type { ChallengeView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { PlayerTag } from '../components/PlayerTag.tsx';
import { settingsText, useT } from '../i18n/index.ts';
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

  if (error) return <main class="page-small box box-pad"><h1 class="box__top">{t.challenge.title}</h1><p class="error">{error}</p></main>;
  if (!challenge) return <main class="page-small box box-pad" />;

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
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main class="page-small box box-pad challenge-page">
      <h1 class="box__top">{t.challenge.title}</h1>
      <p>{settingsText(t, challenge.settings)}</p>
      <p>
        {t.challenge.challenger}: <PlayerTag player={{ ...challenge.challenger, ratingDiff: null }} /> · {t.challenge.challengerColor}:{' '}
        {t.colorChoices[challenge.settings.color]} · {t.challenge.starts}: {t.colorChoices[challenge.settings.firstPlayer]}
      </p>
      {challenge.status === 'canceled' && <p class="ligungi-notice">{t.challenge.canceled}</p>}
      {challenge.status === 'open' && challenge.mine && (
        <>
          <p>{t.challenge.share}</p>
          <div class="copy-me">
            <input class="copy-me__target" readOnly spellcheck={false} value={link} onFocus={(e) => (e.target as HTMLInputElement).select()} />
            <button type="button" class="copy-me__button button" onClick={copy}>
              {copied ? t.challenge.copied : t.challenge.copy}
            </button>
          </div>
          <p class="ligungi-notice">{t.challenge.waiting}</p>
          <button type="button" class="button button-empty button-red" onClick={cancel}>
            {t.challenge.cancel}
          </button>
        </>
      )}
      {challenge.status === 'open' && !challenge.mine && (
        <>
          {challenge.settings.rated && !user ? (
            <p class="ligungi-notice">{t.challenge.ratedLogin}</p>
          ) : (
            <button type="button" class="button ligungi-submit" onClick={accept}>
              {t.challenge.accept}
            </button>
          )}
        </>
      )}
    </main>
  );
};

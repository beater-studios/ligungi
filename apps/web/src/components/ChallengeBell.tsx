import { opposite } from '@ligungi/engine';
import type { ChallengeView, GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { incoming, turns } from '../challenges.ts';
import { formatClock, playerName, settingsText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../router.ts';
import { useStore } from '../store.ts';
import { PlayerTag } from './PlayerTag.tsx';
import { useDropdown } from './useDropdown.ts';

const Item = ({ challenge, onError }: { challenge: ChallengeView; onError: (message: string) => void }) => {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const run = async (action: 'accept' | 'decline') => {
    setBusy(true);
    try {
      const result = await api.post<{ gameId?: string }>(`/api/challenges/${challenge.id}/${action}`);
      if (result.gameId) navigate(`/${result.gameId}`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li class="ligungi-challenge">
      <div class="ligungi-challenge__info">
        <PlayerTag player={{ ...challenge.challenger, ratingDiff: null }} />
        <a href={`/challenge/${challenge.id}`}>{settingsText(t, challenge.settings)}</a>
        <small>
          {t.challenge.challengerColor}: {t.colorChoices[challenge.settings.color]}
        </small>
      </div>
      <div class="ligungi-challenge__actions">
        <button
          type="button"
          class="button"
          data-icon={icons.Checkmark}
          title={t.challenge.accept}
          aria-label={t.challenge.accept}
          disabled={busy}
          onClick={() => void run('accept')}
        />
        <button
          type="button"
          class="button button-empty button-red"
          data-icon={icons.X}
          title={t.challenge.decline}
          aria-label={t.challenge.decline}
          disabled={busy}
          onClick={() => void run('decline')}
        />
      </div>
    </li>
  );
};

/** A correspondence game waiting for the viewer's move: the opponent and how long is left. */
const Turn = ({ game }: { game: GameSummary }) => {
  const t = useT();
  const opponent = game.players[opposite(game.turn ?? 'white')];
  return (
    <li class="ligungi-turn">
      <a href={`/${game.id}`}>
        <span class="ligungi-turn__name">{t.nav.turnAgainst(playerName(t, opponent))}</span>
        <small>
          {t.modes[game.mode]} · {game.deadlineIn !== null ? t.nav.timeLeft(formatClock(game.deadlineIn)) : ''}
        </small>
      </a>
    </li>
  );
};

/** lila's challenge toggle in the top bar: a count badge and a dropdown to accept or decline, and the games waiting for a move. */
export const ChallengeBell = () => {
  const t = useT();
  const list = useStore(incoming);
  const waiting = useStore(turns);
  const count = list.length + waiting.length;
  const { shown, setShown, ref } = useDropdown();
  const [error, setError] = useState<string | null>(null);
  const { path } = useLocation();
  useEffect(() => setShown(false), [path]);
  useEffect(() => setError(null), [shown]);
  const label = count ? `${t.nav.challenges} (${count})` : t.nav.challenges;
  return (
    <div class={`ligungi-challenges${shown ? ' shown' : ''}`} ref={ref}>
      <button type="button" class="toggle link" title={label} aria-label={label} aria-expanded={shown} onClick={() => setShown(!shown)}>
        <span class="data-count" data-count={count} data-icon={icons.Swords} />
      </button>
      {shown && (
        <div class="dropdown ligungi-challenges__list">
          {waiting.length > 0 && (
            <>
              <p class="ligungi-challenges__heading">{t.nav.yourTurn}</p>
              <ul>
                {waiting.map((game) => (
                  <Turn key={game.id} game={game} />
                ))}
              </ul>
            </>
          )}
          {list.length ? (
            <>
              {waiting.length > 0 && <p class="ligungi-challenges__heading">{t.nav.challenges}</p>}
              <ul>
                {list.map((challenge) => (
                  <Item key={challenge.id} challenge={challenge} onError={setError} />
                ))}
              </ul>
            </>
          ) : (
            waiting.length === 0 && <p class="ligungi-challenges__empty">{t.nav.noChallenges}</p>
          )}
          {error && <p class="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

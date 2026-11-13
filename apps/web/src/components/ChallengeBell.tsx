import type { ChallengeView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { incoming } from '../challenges.ts';
import { settingsText, useT } from '../i18n/index.ts';
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

/** lila's challenge toggle in the top bar: a count badge and a dropdown to accept or decline. */
export const ChallengeBell = () => {
  const t = useT();
  const list = useStore(incoming);
  const { shown, setShown, ref } = useDropdown();
  const [error, setError] = useState<string | null>(null);
  const { path } = useLocation();
  useEffect(() => setShown(false), [path]);
  useEffect(() => setError(null), [shown]);
  const label = list.length ? `${t.nav.challenges} (${list.length})` : t.nav.challenges;
  return (
    <div class={`ligungi-challenges${shown ? ' shown' : ''}`} ref={ref}>
      <button type="button" class="toggle link" title={label} aria-label={label} aria-expanded={shown} onClick={() => setShown(!shown)}>
        <span class="data-count" data-count={list.length} data-icon={icons.Swords} />
      </button>
      {shown && (
        <div class="dropdown ligungi-challenges__list">
          {list.length ? (
            <ul>
              {list.map((challenge) => (
                <Item key={challenge.id} challenge={challenge} onError={setError} />
              ))}
            </ul>
          ) : (
            <p class="ligungi-challenges__empty">{t.nav.noChallenges}</p>
          )}
          {error && <p class="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

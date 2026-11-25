import { opposite } from '@ligungi/engine';
import type { ChallengeView, GameSummary, NoticeView } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { incoming, noticePath, noticeText, notices, turns } from '../game/challenges.ts';
import { formatClock, playerName, settingsText, timeAgo, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../core/router.ts';
import { useStore } from '../core/store.ts';
import { PlayerTag } from '../players/PlayerTag.tsx';
import { useDropdown } from '../core/useDropdown.ts';

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

/** A follower or a moderation decision; unread ones stand out until the dropdown is closed. */
const Notice = ({ notice }: { notice: NoticeView }) => {
  const t = useT();
  const path = noticePath(notice);
  const body = (
    <>
      <span class="ligungi-bell-notice__text">
        {!notice.read && <span class="ligungi-sr-only">{t.notices.unread}: </span>}
        {noticeText(t, notice)}
      </span>
      <small>{timeAgo(t, notice.createdAt)}</small>
    </>
  );
  return (
    <li class={`ligungi-bell-notice${notice.read ? '' : ' ligungi-bell-notice--unread'}`}>
      {path ? <a href={path}>{body}</a> : <div>{body}</div>}
    </li>
  );
};

/**
 * The bell in the top bar: a count badge and a dropdown with the games waiting for a move, the challenges to accept
 * or decline, and the notices about followers and moderation.
 */
export const ChallengeBell = () => {
  const t = useT();
  const list = useStore(incoming);
  const waiting = useStore(turns);
  const noted = useStore(notices);
  const unread = noted.filter((notice) => !notice.read).length;
  const count = list.length + waiting.length + unread;
  const { shown, setShown, ref } = useDropdown();
  const [error, setError] = useState<string | null>(null);
  const { path } = useLocation();
  useEffect(() => setShown(false), [path]);
  useEffect(() => setError(null), [shown]);
  // Read once seen: marked when the dropdown closes, so the unread ones still stand out while it is open.
  const wasShown = useRef(false);
  useEffect(() => {
    if (wasShown.current && !shown && unread > 0) void api.post('/api/notices/read').catch(() => {});
    wasShown.current = shown;
  }, [shown]);
  const label = count ? `${t.nav.notifications} (${count})` : t.nav.notifications;
  return (
    <div class={`ligungi-challenges${shown ? ' shown' : ''}`} ref={ref}>
      <button type="button" class="toggle link" title={label} aria-label={label} aria-expanded={shown} onClick={() => setShown(!shown)}>
        <span class="data-count" data-count={count} data-icon={icons.BellOutline} />
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
          {list.length > 0 && (
            <>
              <p class="ligungi-challenges__heading">{t.nav.challenges}</p>
              <ul>
                {list.map((challenge) => (
                  <Item key={challenge.id} challenge={challenge} onError={setError} />
                ))}
              </ul>
            </>
          )}
          {noted.length > 0 && (
            <>
              <p class="ligungi-challenges__heading">{t.notices.title}</p>
              <ul>
                {noted.map((notice) => (
                  <Notice key={notice.id} notice={notice} />
                ))}
              </ul>
            </>
          )}
          {count === 0 && noted.length === 0 && <p class="ligungi-challenges__empty">{t.nav.noNotifications}</p>}
          {error && <p class="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

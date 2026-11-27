import { opposite } from '@ligungi/engine';
import { DAY_MS, type ChallengeView, type GameSummary, type NoticeView } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { incoming, noticePath, noticeText, notices, turns } from '../game/challenges.ts';
import { formatClock, playerName, speedText, timeAgo, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../core/router.ts';
import { useStore } from '../core/store.ts';
import { PlayerTag } from '../players/PlayerTag.tsx';
import { useDropdown } from '../core/useDropdown.ts';

/** Which icon and tone a notice gets: follows, moderation decisions and studies each look different. */
const NOTICE_LOOK: Record<NoticeView['kind'], { readonly icon: string; readonly tone: string }> = {
  follow: { icon: icons.User, tone: 'follow' },
  reportClosed: { icon: icons.Agent, tone: 'mod' },
  renamed: { icon: icons.Agent, tone: 'mod' },
  profileCleared: { icon: icons.Agent, tone: 'mod' },
  gameVoided: { icon: icons.Agent, tone: 'mod' },
  suspensionLifted: { icon: icons.Agent, tone: 'mod' },
  studyHidden: { icon: icons.StudyBoard, tone: 'study' },
  studyRestored: { icon: icons.StudyBoard, tone: 'study' },
  studyDeleted: { icon: icons.StudyBoard, tone: 'study' },
  studyDrawingsCleared: { icon: icons.StudyBoard, tone: 'study' },
  arenaSoon: { icon: icons.Trophy, tone: 'arena' },
  arenaResult: { icon: icons.Trophy, tone: 'arena' },
};

/** The text with the first mention of `name` (a player or a study) in bold, so it stands out from the sentence. */
const withName = (text: string, name: string | null | undefined) => {
  const at = name ? text.indexOf(name) : -1;
  if (!name || at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong>{name}</strong>
      {text.slice(at + name.length)}
    </>
  );
};

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
  const { settings } = challenge;
  // The challenger picked a color; the one who receives the challenge plays the other.
  const mine = settings.color === 'random' ? 'random' : opposite(settings.color);
  return (
    <li class="ligungi-bell__item ligungi-bell__item--challenge">
      <span class="ligungi-bell__icon" data-icon={icons.Swords} aria-hidden="true" />
      <div class="ligungi-bell__body">
        <PlayerTag player={{ ...challenge.challenger, ratingDiff: null }} />
        <a class="ligungi-bell__chips" href={`/challenge/${challenge.id}`}>
          <span class="ligungi-bell__chip">
            {t.modes[settings.mode]}
            {settings.freeDraft ? ` (${t.freeDraftTag})` : ''}
          </span>
          <span class="ligungi-bell__chip" data-icon={icons.Clock}>
            {speedText(t, settings)}
          </span>
          <span class={`ligungi-bell__chip${settings.rated ? ' ligungi-bell__chip--rated' : ''}`}>{settings.rated ? t.rated : t.casual}</span>
        </a>
        <span class="ligungi-bell__color">
          <span class={`ligungi-bell__disc ligungi-bell__disc--${mine}`} aria-hidden="true" />
          {t.challenge.youPlay(mine)}
        </span>
        <div class="ligungi-bell__buttons">
          <button type="button" class="button" data-icon={icons.Checkmark} disabled={busy} onClick={() => void run('accept')}>
            {t.game.accept}
          </button>
          <button type="button" class="button button-empty" data-icon={icons.X} disabled={busy} onClick={() => void run('decline')}>
            {t.challenge.decline}
          </button>
        </div>
      </div>
    </li>
  );
};

/** A correspondence game waiting for the viewer's move: the opponent and how long is left, in warning color on the last day. */
const Turn = ({ game }: { game: GameSummary }) => {
  const t = useT();
  const opponent = playerName(t, game.players[opposite(game.turn ?? 'white')]);
  const urgent = game.deadlineIn !== null && game.deadlineIn < DAY_MS;
  return (
    <li class="ligungi-bell__item ligungi-bell__item--turn">
      <a href={`/${game.id}`}>
        <span class="ligungi-bell__icon" data-icon={icons.Clock} aria-hidden="true" />
        <span class="ligungi-bell__body">
          <span>{withName(t.nav.turnAgainst(opponent), opponent)}</span>
          <small>
            {t.modes[game.mode]}
            {game.deadlineIn !== null && (
              <>
                {' · '}
                <span class={urgent ? 'ligungi-bell__urgent' : undefined}>{t.nav.timeLeft(formatClock(game.deadlineIn))}</span>
              </>
            )}
          </small>
        </span>
      </a>
    </li>
  );
};

/** A follower or a moderation decision; unread ones stand out until the dropdown is closed. */
const Notice = ({ notice }: { notice: NoticeView }) => {
  const t = useT();
  const path = noticePath(notice);
  const look = NOTICE_LOOK[notice.kind];
  const body = (
    <>
      <span class={`ligungi-bell__icon ligungi-bell__icon--${look.tone}`} data-icon={look.icon} aria-hidden="true" />
      <span class="ligungi-bell__body">
        <span>
          {!notice.read && <span class="ligungi-sr-only">{t.notices.unread}: </span>}
          {withName(noticeText(t, notice), notice.kind === 'follow' ? notice.actor : notice.subject)}
        </span>
        <small>{timeAgo(t, notice.createdAt)}</small>
      </span>
    </>
  );
  return (
    <li class={`ligungi-bell__item ligungi-bell__item--notice${notice.read ? '' : ' is-unread'}`}>
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
        <div class="dropdown ligungi-challenges__list ligungi-bell">
          <div class="ligungi-bell__head">
            <span>{t.nav.notifications}</span>
            {count > 0 && <span class="ligungi-bell__count">{t.nav.newNotices(count)}</span>}
          </div>
          {waiting.length > 0 && (
            <>
              <p class="ligungi-bell__heading">{t.nav.yourTurn}</p>
              <ul>
                {waiting.map((game) => (
                  <Turn key={game.id} game={game} />
                ))}
              </ul>
            </>
          )}
          {list.length > 0 && (
            <>
              <p class="ligungi-bell__heading">{t.nav.challenges}</p>
              <ul>
                {list.map((challenge) => (
                  <Item key={challenge.id} challenge={challenge} onError={setError} />
                ))}
              </ul>
            </>
          )}
          {noted.length > 0 && (
            <>
              <p class="ligungi-bell__heading">{t.notices.title}</p>
              <ul>
                {noted.map((notice) => (
                  <Notice key={notice.id} notice={notice} />
                ))}
              </ul>
            </>
          )}
          {count === 0 && noted.length === 0 && <p class="ligungi-bell__empty">{t.nav.noNotifications}</p>}
          {error && <p class="error">{error}</p>}
        </div>
      )}
    </div>
  );
};

import { MODES, type Mode } from '@ligungi/engine';
import {
  TIME_PRESETS,
  sameTimeControl,
  type GameSettings,
  type LobbyView,
  type SeekView,
  type TimeControl,
} from '@ligungi/protocol';
import { playerName, settingsText, speedText, timeControlText, useT } from '../../i18n/index.ts';
import { useLessonProgress } from '../../learn/lessonProgress.ts';

export const QUICK_MODE_KEY = 'ligungi.quickMode';

/** The mode last picked for quick pairing; storage may be missing (prerender) or blocked. */
export const storedQuickMode = (): Mode => {
  try {
    const stored = localStorage.getItem(QUICK_MODE_KEY);
    return MODES.find((mode) => mode === stored) ?? 'advanced';
  } catch {
    return 'advanced';
  }
};

/** Open seeks that a quick pairing seek with these settings would be paired with, as the server pairs them. */
const waitingFor = (seeks: readonly SeekView[], settings: Pick<GameSettings, 'mode' | 'rated' | 'timeControl'>): number =>
  seeks.filter(
    (seek) =>
      !seek.mine &&
      seek.settings.mode === settings.mode &&
      seek.settings.rated === settings.rated &&
      !seek.settings.freeDraft &&
      sameTimeControl(seek.settings.timeControl, settings.timeControl),
  ).length;

/** Shown in place of the quick pairing grid while the player's own games wait in the lobby. */
const Waiting = ({ seeks, onCancel }: { seeks: readonly SeekView[]; onCancel: (seek: SeekView) => void }) => {
  const t = useT();
  return (
    <div class="ligungi-waiting" role="status">
      <div class="ligungi-waiting__spinner" aria-hidden="true" />
      <h2>{t.home.waitingTitle}</h2>
      {seeks.map((seek) => (
        <div key={seek.id} class="ligungi-waiting__seek">
          <span>{settingsText(t, seek.settings)}</span>
          <button type="button" class="button button-empty button-red" onClick={() => onCancel(seek)}>
            {t.home.cancelSeek}
          </button>
        </div>
      ))}
      <p class="ligungi-waiting__hint">{t.home.waitingHint}</p>
    </div>
  );
};

/** Points a signed-out visitor who has not started the lessons to them and to the computer, before the human queue. */
const NewcomerHint = () => {
  const t = useT();
  const { progress } = useLessonProgress();
  if (!progress || Object.keys(progress).length > 0) return null;
  return <p class="ligungi-home__newcomer">{t.home.newcomer}</p>;
};

export const QuickGame = ({
  mode,
  rated,
  lobby,
  mine,
  onMode,
  onPool,
  onCancel,
}: {
  mode: Mode;
  rated: boolean;
  lobby: LobbyView | null;
  mine: readonly SeekView[];
  onMode: (mode: Mode) => void;
  onPool: (timeControl: TimeControl) => void;
  onCancel: (seek: SeekView) => void;
}) => {
  const t = useT();
  return (
    <section class="ligungi-card ligungi-home__quick">
      <div class="ligungi-home__quick-head">
        <h1>{t.home.quickGame}</h1>
        <div class="ligungi-segmented ligungi-home__modes" role="group" aria-label={t.common.mode}>
          {MODES.map((m) => (
            <button key={m} type="button" class={m === mode ? 'active' : ''} aria-pressed={m === mode} onClick={() => onMode(m)}>
              {t.modes[m]}
            </button>
          ))}
        </div>
      </div>
      {mine.length > 0 ? (
        <Waiting seeks={mine} onCancel={onCancel} />
      ) : (
        <>
          {!rated && <NewcomerHint />}
          <div class="ligungi-pools">
            {TIME_PRESETS.map((timeControl) => {
              const waiting = waitingFor(lobby?.seeks ?? [], { mode, rated, timeControl });
              return (
                <button key={timeControlText(t, timeControl)} type="button" class="ligungi-pool" onClick={() => onPool(timeControl)}>
                  <span class="ligungi-pool__clock">{timeControlText(t, timeControl)}</span>
                  <span class="ligungi-pool__kind">{rated ? t.rated : t.casual}</span>
                  <span class={`ligungi-pool__waiting${waiting > 0 ? ' is-waiting' : ''}`}>{t.home.waiting(waiting)}</span>
                </button>
              );
            })}
          </div>
          <p class="ligungi-home__hint">{t.home.quickHint}</p>
        </>
      )}
    </section>
  );
};

export const SeekRow = ({ seek, onAccept, onCancel }: { seek: SeekView; onAccept: (s: SeekView) => void; onCancel: (s: SeekView) => void }) => {
  const t = useT();
  const { settings } = seek;
  const mode = `${t.modes[settings.mode]}${settings.freeDraft ? ` (${t.freeDraftTag})` : ''}`;
  const kind = settings.rated ? t.rated : t.casual;
  return (
    <li class={`ligungi-seek${seek.mine ? ' ligungi-seek--mine' : ''}`}>
      <span class="ligungi-seek__player">
        <span class={`is is2 color-icon ${settings.color}`} title={t.colorChoices[settings.color]} />
        <span class="ligungi-seek__name">{playerName(t, seek.player)}</span>
        {seek.player.rating !== null && <span class="ligungi-seek__rating">{seek.player.rating}</span>}
      </span>
      <span class="ligungi-seek__time">{settings.daysPerMove ? t.days(settings.daysPerMove) : speedText(t, settings)}</span>
      <span class="ligungi-seek__mode">{mode}</span>
      <span class="ligungi-seek__kind">{kind}</span>
      {/* Phones: the settings on one line under the name. */}
      <span class="ligungi-seek__meta">{[mode, speedText(t, settings), kind].join(' · ')}</span>
      {seek.mine ? (
        <button type="button" class="button button-empty button-red ligungi-seek__action" onClick={() => onCancel(seek)}>
          {t.home.cancel}
        </button>
      ) : (
        <button type="button" class="button ligungi-button-good ligungi-seek__action" onClick={() => onAccept(seek)}>
          {t.home.join}
        </button>
      )}
    </li>
  );
};

import { MODES, MODE_RULES, type Mode } from '@ligungi/engine';
import {
  BYOYOMI_PERIODS_MAX,
  BYOYOMI_SECONDS,
  CORRESPONDENCE_DAYS,
  formatTimeControl,
  type ChallengeView,
  type ColorChoice,
  type GameSettings,
  type TimeControl,
} from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../api.ts';
import { colorChoiceOptions, useT } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';
import { Modal } from './Modal.tsx';
import { Checkbox, OptionCards, Slider, SubmitButton } from './ui.tsx';

const MINUTES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
const INCREMENTS = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60];
/** Byo-yomi may start right away, with no main time. */
const BYOYOMI_MINUTES = [0, ...MINUTES];
const PERIODS = Array.from({ length: BYOYOMI_PERIODS_MAX }, (_, i) => i + 1);

export type CreateTarget = 'lobby' | 'friend';

/** Live with a clock, correspondence (days per move) or no clock at all. */
type Speed = 'live' | 'correspondence' | 'unlimited';

/** A Fischer clock (time plus increment) or byo-yomi (time, then a fixed period per move). */
type ClockKind = 'increment' | 'byoyomi';

/**
 * Creating a game: in the lobby, as a link for a friend, or as a challenge to a player (`to`). One window for all three,
 * short enough to need no scrolling: the mode and every choice are buttons side by side, the clock values sliders under a
 * summary of the time control and a sentence that says what it means.
 */
export const CreateGame = ({ target, to, onClose }: { target: CreateTarget; to?: string; onClose: () => void }) => {
  const t = useT();
  const { user } = useStore(session);
  const [mode, setMode] = useState<Mode>('advanced');
  const [speed, setSpeed] = useState<Speed>('live');
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(10);
  const [increment, setIncrement] = useState(5);
  const [clockKind, setClockKind] = useState<ClockKind>('increment');
  const [byoyomi, setByoyomi] = useState(30);
  const [periods, setPeriods] = useState(1);
  const [rated, setRated] = useState(Boolean(user));
  const [color, setColor] = useState<ColorChoice>('random');
  const [freeDraft, setFreeDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canRate = Boolean(user) && speed !== 'unlimited';
  const draftMode = MODE_RULES[mode].draft;
  const free = draftMode && freeDraft && !(canRate && rated);
  const byo = clockKind === 'byoyomi';

  const timeControl: TimeControl | null =
    speed !== 'live' ? null : byo ? { initial: minutes * 60, increment: 0, byoyomi, periods } : { initial: Math.max(1, minutes) * 60, increment };

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const settings: GameSettings = {
      mode,
      rated: canRate && rated,
      timeControl,
      daysPerMove: speed === 'correspondence' ? days : null,
      color,
      freeDraft: free,
    };
    try {
      if (target === 'friend') {
        const challenge = await api.post<ChallengeView>('/api/challenges', to ? { ...settings, to } : settings);
        onClose();
        navigate(`/challenge/${challenge.id}`);
      } else {
        const result = await api.post<{ seekId?: string; gameId?: string }>('/api/seeks', settings);
        onClose();
        if (result.gameId) navigate(`/${result.gameId}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pickClock = (kind: ClockKind) => {
    setClockKind(kind);
    // A Fischer clock needs some main time.
    if (kind === 'increment' && minutes === 0) setMinutes(1);
  };

  return (
    <Modal title={to ? t.create.challengeTitle(to) : target === 'friend' ? t.create.friendTitle : t.create.lobbyTitle} onClose={onClose}>
      <form class="form3 create-game ligungi-create" onSubmit={submit}>
        <OptionCards
          name="cg-mode"
          legend={t.common.mode}
          layout="segmented"
          value={mode}
          options={MODES.map((m) => ({ value: m, label: t.modes[m] }))}
          onChange={setMode}
          help={t.modeDescriptions[mode]}
        />

        <div class="ligungi-create__speed">
          <OptionCards
            name="cg-speed"
            legend={t.create.speed}
            layout="segmented"
            value={speed}
            options={[
              { value: 'live' as const, label: t.create.speedLive },
              { value: 'correspondence' as const, label: t.create.speedCorrespondence, disabled: !user, title: user ? '' : t.create.correspondenceLogin },
              { value: 'unlimited' as const, label: t.noClock },
            ]}
            onChange={setSpeed}
          />
          {speed === 'live' && (
            <div class="ligungi-create__box">
              <div class="ligungi-create__clock">
                <OptionCards
                  name="cg-clock"
                  legend={t.create.clock}
                  hideLegend
                  layout="segmented"
                  value={clockKind}
                  options={[
                    { value: 'increment' as const, label: t.create.clockIncrement },
                    { value: 'byoyomi' as const, label: t.create.clockByoyomi },
                  ]}
                  onChange={pickClock}
                />
                <strong class="ligungi-create__summary">{formatTimeControl(timeControl)}</strong>
              </div>
              <Slider id="cg-minutes" label={t.create.minutes} values={byo ? BYOYOMI_MINUTES : MINUTES} value={minutes} onChange={setMinutes} />
              {byo ? (
                <>
                  <OptionCards
                    name="cg-byoyomi"
                    legend={t.create.byoyomiSeconds}
                    layout="segmented"
                    value={byoyomi}
                    options={BYOYOMI_SECONDS.map((s) => ({ value: s, label: `${s} s` }))}
                    onChange={setByoyomi}
                  />
                  <OptionCards
                    name="cg-periods"
                    legend={t.create.periods}
                    layout="segmented"
                    value={periods}
                    options={PERIODS.map((n) => ({ value: n, label: String(n) }))}
                    onChange={setPeriods}
                  />
                </>
              ) : (
                <Slider id="cg-increment" label={t.create.increment} values={INCREMENTS} value={increment} format={(s) => `${s} s`} onChange={setIncrement} />
              )}
              <p class="ligungi-create__note">{byo ? t.create.byoyomiText(minutes, byoyomi, periods) : t.create.incrementText(Math.max(1, minutes), increment)}</p>
            </div>
          )}
          {speed === 'correspondence' && (
            <div class="ligungi-create__box">
              <OptionCards
                name="cg-days"
                legend={t.create.daysPerMove}
                layout="segmented"
                value={days}
                options={CORRESPONDENCE_DAYS.map((n) => ({ value: n, label: t.days(n) }))}
                onChange={setDays}
              />
              <p class="ligungi-create__note">{t.create.correspondenceHelp}</p>
            </div>
          )}
          {speed === 'unlimited' && <p class="ligungi-create__box ligungi-create__note">{t.create.unlimitedNote}</p>}
        </div>

        <div class="ligungi-create__type">
          <OptionCards
            name="cg-rated"
            legend={t.create.type}
            layout="segmented"
            value={rated && canRate}
            options={[
              { value: false, label: t.casual },
              { value: true, label: t.rated, disabled: !canRate, title: user ? '' : t.create.loginForRated },
            ]}
            onChange={setRated}
          />
          {draftMode && (
            <Checkbox
              id="cg-free"
              checked={free}
              disabled={canRate && rated}
              title={canRate && rated ? t.freeDraftRatedHint : t.freeDraftHint}
              label={t.freeDraftLabel}
              onChange={(checked) => {
                setFreeDraft(checked);
                if (checked) setRated(false);
              }}
            />
          )}
        </div>

        <OptionCards
          name="cg-color"
          legend={t.common.yourColor}
          layout="segmented"
          value={color}
          options={colorChoiceOptions(t).map((option) => ({
            ...option,
            icon: <span class={`ligungi-choice__disc ligungi-choice__disc--${option.value}`} aria-hidden="true" />,
          }))}
          onChange={setColor}
          help={t.common.whiteStarts}
        />

        {error && <p class="error">{error}</p>}
        <SubmitButton disabled={busy}>{to ? t.create.sendChallenge : target === 'friend' ? t.create.createLink : t.create.create}</SubmitButton>
      </form>
    </Modal>
  );
};

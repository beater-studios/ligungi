import { MODES, MODE_RULES, type Mode } from '@ligungi/engine';
import type { ChallengeView, ColorChoice, GameSettings } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../api.ts';
import { colorChoiceOptions, useT } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';
import { Modal } from './Modal.tsx';
import { Checkbox, Field, FieldRow, RadioGroup, Select, SubmitButton } from './ui.tsx';

const MINUTES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
const INCREMENTS = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60];

export type CreateTarget = 'lobby' | 'friend';

/** `to` turns the friend form into a challenge sent to that player from their profile. */
export const CreateGame = ({ target, to, onClose }: { target: CreateTarget; to?: string; onClose: () => void }) => {
  const t = useT();
  const { user } = useStore(session);
  const [mode, setMode] = useState<Mode>('advanced');
  const [unlimited, setUnlimited] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [increment, setIncrement] = useState(5);
  const [rated, setRated] = useState(Boolean(user));
  const [color, setColor] = useState<ColorChoice>('random');
  const [firstPlayer, setFirstPlayer] = useState<ColorChoice>('random');
  const [freeDraft, setFreeDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canRate = Boolean(user) && !unlimited;
  const draftMode = MODE_RULES[mode].draft;
  const free = draftMode && freeDraft && !(canRate && rated);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const settings: GameSettings = {
      mode,
      rated: canRate && rated,
      timeControl: unlimited ? null : { initial: minutes * 60, increment },
      color,
      firstPlayer,
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

  const colorOptions = colorChoiceOptions(t);

  return (
    <Modal title={to ? t.create.challengeTitle(to) : target === 'friend' ? t.create.friendTitle : t.create.lobbyTitle} onClose={onClose}>
      <form class="form3 create-game" onSubmit={submit}>
        <Field label={t.common.mode} htmlFor="cg-mode" help={t.modeDescriptions[mode]}>
          <Select id="cg-mode" value={mode} options={MODES.map((m) => ({ value: m, label: t.modes[m] }))} onChange={setMode} />
        </Field>
        <Checkbox id="cg-unlimited" checked={unlimited} onChange={setUnlimited} label={t.noClock} />
        {!unlimited && (
          <FieldRow>
            <Field label={t.create.minutes} htmlFor="cg-minutes">
              <Select id="cg-minutes" value={minutes} options={MINUTES.map((m) => ({ value: m, label: m }))} onChange={setMinutes} />
            </Field>
            <Field label={t.create.increment} htmlFor="cg-increment">
              <Select id="cg-increment" value={increment} options={INCREMENTS.map((sec) => ({ value: sec, label: sec }))} onChange={setIncrement} />
            </Field>
          </FieldRow>
        )}
        <Field label={t.create.type}>
          <RadioGroup
            name="cg-rated"
            value={rated && canRate}
            options={[
              { value: false, label: t.casual },
              { value: true, label: t.rated, disabled: !canRate, title: user ? '' : t.create.loginForRated },
            ]}
            onChange={setRated}
          />
        </Field>
        {draftMode && (
          <Checkbox
            id="cg-free"
            checked={free}
            disabled={canRate && rated}
            title={t.freeDraftHint}
            label={t.freeDraftLabel}
            help={canRate && rated ? t.freeDraftRatedHint : t.freeDraftHint}
            onChange={(checked) => {
              setFreeDraft(checked);
              if (checked) setRated(false);
            }}
          />
        )}
        <Field label={t.common.yourColor}>
          <RadioGroup name="cg-color" value={color} options={colorOptions} onChange={setColor} />
        </Field>
        <Field label={t.common.whoStarts}>
          <RadioGroup name="cg-first" value={firstPlayer} options={colorOptions} onChange={setFirstPlayer} />
        </Field>
        {error && <p class="error">{error}</p>}
        <SubmitButton disabled={busy}>{to ? t.create.sendChallenge : target === 'friend' ? t.create.createLink : t.create.create}</SubmitButton>
      </form>
    </Modal>
  );
};

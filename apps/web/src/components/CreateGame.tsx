import { MODES, MODE_RULES, type Mode } from '@ligungi/engine';
import type { ChallengeView, ColorChoice, GameSettings } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../api.ts';
import { useT } from '../i18n/index.ts';
import { navigate } from '../router.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';
import { Modal } from './Modal.tsx';

const MINUTES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
const INCREMENTS = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60];

export type CreateTarget = 'lobby' | 'friend';

export const CreateGame = ({ target, onClose }: { target: CreateTarget; onClose: () => void }) => {
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
        const challenge = await api.post<ChallengeView>('/api/challenges', settings);
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

  const choice = (name: string, current: ColorChoice, set: (c: ColorChoice) => void) => (
    <group class="radio">
      {(['white', 'random', 'black'] as const).map((value) => (
        <div key={value}>
          <input type="radio" id={`${name}-${value}`} name={name} checked={value === current} onChange={() => set(value)} />
          <label for={`${name}-${value}`}>{t.colorChoices[value]}</label>
        </div>
      ))}
    </group>
  );

  return (
    <Modal title={target === 'friend' ? t.create.friendTitle : t.create.lobbyTitle} onClose={onClose}>
      <form class="form3 create-game" onSubmit={submit}>
        <div class="form-group">
          <label class="form-label" for="cg-mode">{t.common.mode}</label>
          <select id="cg-mode" class="form-control" value={mode} onChange={(e) => setMode((e.target as HTMLSelectElement).value as Mode)}>
            {MODES.map((m) => (
              <option key={m} value={m}>{t.modes[m]}</option>
            ))}
          </select>
          <small class="form-help">{t.modeDescriptions[mode]}</small>
        </div>
        <div class="form-group form-check">
          <input type="checkbox" id="cg-unlimited" class="form-check-input" checked={unlimited} onChange={(e) => setUnlimited((e.target as HTMLInputElement).checked)} />
          <label for="cg-unlimited" class="form-check-label">{t.noClock}</label>
        </div>
        {!unlimited && (
          <div class="form-split">
            <div class="form-group form-half">
              <label class="form-label" for="cg-minutes">{t.create.minutes}</label>
              <select id="cg-minutes" class="form-control" value={minutes} onChange={(e) => setMinutes(Number((e.target as HTMLSelectElement).value))}>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div class="form-group form-half">
              <label class="form-label" for="cg-increment">{t.create.increment}</label>
              <select id="cg-increment" class="form-control" value={increment} onChange={(e) => setIncrement(Number((e.target as HTMLSelectElement).value))}>
                {INCREMENTS.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div class="form-group">
          <span class="form-label">{t.create.type}</span>
          <group class="radio">
            <div>
              <input type="radio" id="cg-casual" name="rated" checked={!rated || !canRate} onChange={() => setRated(false)} />
              <label for="cg-casual">{t.casual}</label>
            </div>
            <div title={user ? '' : t.create.loginForRated}>
              <input type="radio" id="cg-rated" name="rated" disabled={!canRate} checked={rated && canRate} onChange={() => setRated(true)} />
              <label for="cg-rated">{t.rated}</label>
            </div>
          </group>
        </div>
        {draftMode && (
          <div class="form-group form-check" title={t.freeDraftHint}>
            <input
              type="checkbox"
              id="cg-free"
              class="form-check-input"
              checked={free}
              disabled={canRate && rated}
              onChange={(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                setFreeDraft(checked);
                if (checked) setRated(false);
              }}
            />
            <label for="cg-free" class="form-check-label">{t.freeDraftLabel}</label>
            <small class="form-help">{canRate && rated ? t.freeDraftRatedHint : t.freeDraftHint}</small>
          </div>
        )}
        <div class="form-group">
          <span class="form-label">{t.common.yourColor}</span>
          {choice('color', color, setColor)}
        </div>
        <div class="form-group">
          <span class="form-label">{t.common.whoStarts}</span>
          {choice('first', firstPlayer, setFirstPlayer)}
        </div>
        {error && <p class="error">{error}</p>}
        <div class="form-actions single">
          <button type="submit" class="button button-fat" disabled={busy}>
            {target === 'friend' ? t.create.createLink : t.create.create}
          </button>
        </div>
      </form>
    </Modal>
  );
};

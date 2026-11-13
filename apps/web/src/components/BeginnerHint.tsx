import { useState } from 'preact/hooks';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { prefs, updatePrefs } from '../prefs.ts';
import { useStore } from '../store.ts';
import { Checkbox } from './ui.tsx';

const KEY = 'ligungi.beginnerHint';

const dismissed = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'dismissed';
  } catch {
    return false;
  }
};

/** Beside the board until closed: the two learning aids, switchable in place, and a link to the rules. */
export const BeginnerHint = () => {
  const t = useT();
  const { moveGuides, hoverReach, pieceStyle } = useStore(prefs);
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, 'dismissed');
    } catch {}
    setHidden(true);
  };
  return (
    <section class="ligungi-beginner box" aria-labelledby="beginner-title">
      <div class="ligungi-beginner__head">
        <h2 id="beginner-title">{t.beginner.title}</h2>
        <button type="button" class="ligungi-beginner__close" aria-label={t.beginner.close} title={t.beginner.close} data-icon={icons.X} onClick={close} />
      </div>
      <p>{t.beginner.text}</p>
      <div class="form3">
        <Checkbox
          id="beginner-illustrated"
          checked={pieceStyle === 'illustrated'}
          onChange={(value) => updatePrefs({ pieceStyle: value ? 'illustrated' : 'kanji' })}
          label={t.beginner.illustrated}
        />
        <Checkbox id="beginner-guides" checked={moveGuides} onChange={(value) => updatePrefs({ moveGuides: value })} label={t.beginner.moveGuides} />
        <Checkbox id="beginner-reach" checked={hoverReach} onChange={(value) => updatePrefs({ hoverReach: value })} label={t.beginner.hoverReach} />
      </div>
      <a href="/learn">{t.beginner.learn}</a>
    </section>
  );
};

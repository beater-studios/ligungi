import { useState } from 'preact/hooks';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { prefs, updatePrefs } from '../prefs/prefs.ts';
import { useStore } from '../core/store.ts';
import { Checkbox } from '../components/ui.tsx';

const KEY = 'ligungi.beginnerHint';

const dismissed = (): boolean => {
  try {
    return localStorage.getItem(KEY) === 'dismissed';
  } catch {
    return false;
  }
};

/** Beside the board until closed: the learning aids, switchable in place, and a link to the rules. */
export const BeginnerHint = () => {
  const t = useT();
  const { moveGuides, hoverReach, pieceStyle, towerContents } = useStore(prefs);
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
        <Checkbox
          id="beginner-tower-contents"
          checked={towerContents !== 'none'}
          onChange={(value) => updatePrefs({ towerContents: value ? 'stack' : 'none' })}
          label={t.beginner.towerContents}
        />
      </div>
      <a href="/learn">{t.beginner.learn}</a>
    </section>
  );
};

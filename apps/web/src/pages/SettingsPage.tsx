import { MESSAGES, useT } from '../i18n/index.ts';
import { LANGS, prefs, updatePrefs, type Prefs } from '../prefs.ts';
import { playSound } from '../sound.ts';
import { useStore } from '../store.ts';

export const SettingsPage = () => {
  const t = useT();
  const s = t.settings;
  const current = useStore(prefs);
  const radio = <K extends keyof Prefs>(key: K, options: Array<[Prefs[K], string]>) => (
    <group class="radio">
      {options.map(([value, label]) => (
        <div key={String(value)}>
          <input
            type="radio"
            id={`pref-${key}-${String(value)}`}
            name={key}
            checked={current[key] === value}
            onChange={() => updatePrefs({ [key]: value } as Partial<Prefs>)}
          />
          <label for={`pref-${key}-${String(value)}`}>{label}</label>
        </div>
      ))}
    </group>
  );
  return (
    <main class="account page-menu">
      <nav class="page-menu__menu subnav">
        <a class="active" href="/settings">
          {s.title}
        </a>
      </nav>
      <div class="page-menu__content box box-pad">
        <h1 class="box__top">{s.title}</h1>
        <form class="form3" onSubmit={(e) => e.preventDefault()}>
          <section>
            <h2>{s.language}</h2>
            {radio('lang', [['auto', s.auto], ...LANGS.map((lang): [Prefs['lang'], string] => [lang, MESSAGES[lang].languageName])])}
          </section>
          <section>
            <h2>{s.pieceNames}</h2>
            {radio('pieceNames', [
              ['local', s.pieceNamesLocal],
              ['ja', s.pieceNamesJapanese],
            ])}
          </section>
          <section>
            <h2>{s.theme}</h2>
            {radio('theme', [
              ['auto', s.auto],
              ['light', s.light],
              ['dark', s.dark],
            ])}
          </section>
          <section>
            <h2>{s.boardSize}</h2>
            <input
              type="range"
              class="range"
              min={0}
              max={100}
              value={current.zoom}
              onInput={(e) => updatePrefs({ zoom: Number((e.target as HTMLInputElement).value) })}
            />
          </section>
          <section>
            <h2>{s.sound}</h2>
            {radio('sound', [
              [true, s.on],
              [false, s.off],
            ])}
            <button type="button" class="button button-empty" onClick={() => playSound('move')}>
              {s.test}
            </button>
          </section>
          <section>
            <h2>{s.coordinates}</h2>
            {radio('coordinates', [
              [true, s.show],
              [false, s.hide],
            ])}
          </section>
          <section>
            <h2>{s.hoverReach}</h2>
            {radio('hoverReach', [
              [true, s.show],
              [false, s.dontShow],
            ])}
            <small class="form-help">{s.hoverReachHelp}</small>
          </section>
          <section>
            <h2>{s.animation}</h2>
            {radio('animation', [
              [true, s.animationOn],
              [false, s.animationOff],
            ])}
          </section>
        </form>
        <p class="ligungi-notice">{s.saved}</p>
      </div>
    </main>
  );
};
